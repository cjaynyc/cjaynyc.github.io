"""
OSINT Investigator — a Streamlit app for username enumeration and evidence reporting.

Features
--------
1. Username search across many platforms using a built-in concurrent HTTP checker,
   with optional ingestion of Sherlock's native ``--csv`` output.
2. Log / free-text URL extraction for tools that don't emit structured output.
3. Evidence reporting with summary metrics, a linkage table, and Markdown / CSV export.

Ethics
------
This tool only queries publicly available information (open profile pages). Use it
responsibly and only on targets you are authorised to investigate.
"""

from __future__ import annotations

import concurrent.futures
import datetime as dt
import io
import json
import re
from dataclasses import dataclass, field

import pandas as pd
import requests
import streamlit as st

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

APP_TITLE = "OSINT Investigator"
DEFAULT_TIMEOUT = 8
DEFAULT_WORKERS = 20
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

# Each site is checked by formatting {} with the username. ``error_type`` controls
# how a "not found" is detected:
#   - "status_code": a 404 (or non-200) means the account does NOT exist.
#   - "message":     the account does NOT exist if ``error_text`` is in the body.
SITES: dict[str, dict] = {
    "GitHub":      {"url": "https://github.com/{}", "error_type": "status_code"},
    "GitLab":      {"url": "https://gitlab.com/{}", "error_type": "status_code"},
    "Reddit":      {"url": "https://www.reddit.com/user/{}", "error_type": "status_code"},
    "Instagram":   {"url": "https://www.instagram.com/{}", "error_type": "status_code"},
    "X (Twitter)": {"url": "https://x.com/{}", "error_type": "status_code"},
    "TikTok":      {"url": "https://www.tiktok.com/@{}", "error_type": "status_code"},
    "Pinterest":   {"url": "https://www.pinterest.com/{}", "error_type": "status_code"},
    "Twitch":      {"url": "https://m.twitch.tv/{}", "error_type": "status_code"},
    "Steam":       {"url": "https://steamcommunity.com/id/{}", "error_type": "message",
                    "error_text": "The specified profile could not be found"},
    "Medium":      {"url": "https://medium.com/@{}", "error_type": "status_code"},
    "Telegram":    {"url": "https://t.me/{}", "error_type": "message",
                    "error_text": "tgme_page_additional"},
    "Spotify":     {"url": "https://open.spotify.com/user/{}", "error_type": "status_code"},
    "SoundCloud":  {"url": "https://soundcloud.com/{}", "error_type": "status_code"},
    "Vimeo":       {"url": "https://vimeo.com/{}", "error_type": "status_code"},
    "Dribbble":    {"url": "https://dribbble.com/{}", "error_type": "status_code"},
    "Behance":     {"url": "https://www.behance.net/{}", "error_type": "status_code"},
    "Keybase":     {"url": "https://keybase.io/{}", "error_type": "status_code"},
    "About.me":    {"url": "https://about.me/{}", "error_type": "status_code"},
    "Patreon":     {"url": "https://www.patreon.com/{}", "error_type": "status_code"},
    "ProductHunt": {"url": "https://www.producthunt.com/@{}", "error_type": "status_code"},
    "Replit":      {"url": "https://replit.com/@{}", "error_type": "status_code"},
    "HackerNews":  {"url": "https://news.ycombinator.com/user?id={}", "error_type": "message",
                    "error_text": "No such user."},
    "Pastebin":    {"url": "https://pastebin.com/u/{}", "error_type": "status_code"},
    "Wordpress":   {"url": "https://{}.wordpress.com", "error_type": "status_code"},
}

USERNAME_RE = re.compile(r"^[A-Za-z0-9._-]{1,40}$")


# --------------------------------------------------------------------------- #
# Data model
# --------------------------------------------------------------------------- #

@dataclass
class Finding:
    platform: str
    url: str
    status: str          # "found" | "not_found" | "error"
    http_status: int | None = None
    note: str = ""

    def as_row(self) -> dict:
        return {
            "Platform": self.platform,
            "Status": self.status,
            "HTTP": self.http_status,
            "URL": self.url,
            "Note": self.note,
        }


# --------------------------------------------------------------------------- #
# Core checking logic
# --------------------------------------------------------------------------- #

def check_site(name: str, spec: dict, username: str, session: requests.Session,
               timeout: int = DEFAULT_TIMEOUT) -> Finding:
    """Check a single site for the given username and classify the result."""
    url = spec["url"].format(username)
    try:
        resp = session.get(url, timeout=timeout, allow_redirects=True)
    except requests.RequestException as exc:
        return Finding(name, url, "error", None, f"request failed: {type(exc).__name__}")

    if spec["error_type"] == "status_code":
        status = "found" if resp.status_code == 200 else "not_found"
        return Finding(name, url, status, resp.status_code)

    # message-based detection
    if resp.status_code != 200:
        return Finding(name, url, "not_found", resp.status_code)
    body = resp.text
    found = spec.get("error_text", "") not in body
    return Finding(name, url, "found" if found else "not_found", resp.status_code)


def enumerate_username(username: str, sites: dict[str, dict],
                       workers: int = DEFAULT_WORKERS,
                       timeout: int = DEFAULT_TIMEOUT,
                       progress=None) -> list[Finding]:
    """Concurrently check ``username`` across all ``sites``."""
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    findings: list[Finding] = []
    total = len(sites)
    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(check_site, name, spec, username, session, timeout): name
            for name, spec in sites.items()
        }
        for fut in concurrent.futures.as_completed(futures):
            findings.append(fut.result())
            done += 1
            if progress is not None:
                progress.progress(done / total, text=f"Checked {done}/{total} platforms")

    findings.sort(key=lambda f: (f.status != "found", f.platform.lower()))
    return findings


# --------------------------------------------------------------------------- #
# Sherlock / log ingestion helpers (from the original scaffold, hardened)
# --------------------------------------------------------------------------- #

class ReportGenerator:
    """Parsing utilities for external tool output."""

    @staticmethod
    def parse_sherlock_csv(file_like) -> pd.DataFrame:
        """Sherlock supports ``--csv`` natively; parse it and keep only found accounts."""
        try:
            df = pd.read_csv(file_like)
        except Exception:
            return pd.DataFrame()
        # Sherlock writes a boolean-ish ``exists`` column ("Claimed"/"Available")
        # or, in some versions, ``is_valid``. Handle both.
        if "exists" in df.columns:
            mask = df["exists"].astype(str).str.lower().isin({"claimed", "true", "yes"})
            return df[mask]
        if "is_valid" in df.columns:
            return df[df["is_valid"].astype(str).str.lower().isin({"true", "yes", "1"})]
        return df  # unknown schema: return as-is so the user still sees something

    @staticmethod
    def extract_from_logs(log_text: str) -> list[str]:
        """Extract unique URLs from arbitrary log text via regex."""
        url_pattern = r"https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+(?:/[^\s\"'<>]*)?"
        return sorted(set(re.findall(url_pattern, log_text)))


# --------------------------------------------------------------------------- #
# Report building / export
# --------------------------------------------------------------------------- #

def build_markdown_report(target: str, df: pd.DataFrame) -> str:
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    found = df[df.get("Status", "found") == "found"] if "Status" in df.columns else df
    lines = [
        f"# OSINT Investigation Report — `{target}`",
        "",
        f"- **Generated:** {now}",
        f"- **Platforms identified:** {len(found)}",
        f"- **Total platforms checked:** {len(df)}",
        "",
        "## Linkage to Sources",
        "",
        "| Platform | Status | URL |",
        "| --- | --- | --- |",
    ]
    for _, row in df.iterrows():
        platform = row.get("Platform", "")
        status = row.get("Status", "")
        url = row.get("URL", "")
        lines.append(f"| {platform} | {status} | {url} |")
    lines += [
        "",
        "---",
        "_Generated by OSINT Investigator. Public-source data only._",
    ]
    return "\n".join(lines)


def findings_to_df(findings: list[Finding]) -> pd.DataFrame:
    return pd.DataFrame([f.as_row() for f in findings])


# --------------------------------------------------------------------------- #
# Streamlit UI
# --------------------------------------------------------------------------- #

def display_report_tab(target: str, df: pd.DataFrame) -> None:
    st.header(f"Investigation Summary: {target}")

    found = df[df["Status"] == "found"] if "Status" in df.columns else df

    col1, col2, col3 = st.columns(3)
    col1.metric("Platforms Identified", len(found))
    col2.metric("Total Checked", len(df))
    errors = len(df[df["Status"] == "error"]) if "Status" in df.columns else 0
    col3.metric("Errors", errors)

    st.subheader("Linkage to Sources")
    st.dataframe(df, use_container_width=True, hide_index=True)

    md = build_markdown_report(target, df)
    csv_buf = io.StringIO()
    df.to_csv(csv_buf, index=False)

    c1, c2 = st.columns(2)
    c1.download_button(
        "⬇️ Download Markdown report",
        data=md,
        file_name=f"osint_report_{target}.md",
        mime="text/markdown",
        use_container_width=True,
    )
    c2.download_button(
        "⬇️ Download CSV evidence",
        data=csv_buf.getvalue(),
        file_name=f"osint_evidence_{target}.csv",
        mime="text/csv",
        use_container_width=True,
    )

    with st.expander("Preview Markdown report"):
        st.markdown(md)


def main() -> None:
    st.set_page_config(page_title=APP_TITLE, page_icon="🕵️", layout="wide")
    st.title("🕵️ " + APP_TITLE)
    st.caption(
        "Username enumeration and evidence reporting from public sources. "
        "Use only on targets you are authorised to investigate."
    )

    with st.sidebar:
        st.header("Settings")
        workers = st.slider("Concurrency", 5, 40, DEFAULT_WORKERS)
        timeout = st.slider("Timeout (s)", 3, 20, DEFAULT_TIMEOUT)
        selected = st.multiselect(
            "Platforms to check",
            options=list(SITES.keys()),
            default=list(SITES.keys()),
        )

    tab_search, tab_import, tab_logs = st.tabs(
        ["🔎 Username Search", "📥 Import Sherlock CSV", "📝 Log URL Extractor"]
    )

    # --- Tab 1: live username search -------------------------------------- #
    with tab_search:
        target = st.text_input("Target username", placeholder="e.g. johndoe").strip()
        run = st.button("Run investigation", type="primary")

        if run:
            if not target:
                st.error("Please enter a username.")
            elif not USERNAME_RE.match(target):
                st.error("Invalid username (allowed: letters, digits, '.', '_', '-').")
            elif not selected:
                st.error("Select at least one platform in the sidebar.")
            else:
                sites = {k: SITES[k] for k in selected}
                progress = st.progress(0.0, text="Starting…")
                findings = enumerate_username(target, sites, workers, timeout, progress)
                progress.empty()
                st.session_state["last_df"] = findings_to_df(findings)
                st.session_state["last_target"] = target

        if "last_df" in st.session_state:
            display_report_tab(st.session_state["last_target"], st.session_state["last_df"])

    # --- Tab 2: Sherlock CSV import --------------------------------------- #
    with tab_import:
        st.write(
            "Run Sherlock with structured output and upload the CSV here:\n\n"
            "```bash\nsherlock TARGET --csv --folderoutput ./results\n```"
        )
        up = st.file_uploader("Upload Sherlock CSV", type=["csv"])
        if up is not None:
            df = ReportGenerator.parse_sherlock_csv(up)
            if df.empty:
                st.warning("No found accounts parsed from this file.")
            else:
                st.success(f"Parsed {len(df)} found account(s).")
                st.dataframe(df, use_container_width=True, hide_index=True)
                csv_buf = io.StringIO()
                df.to_csv(csv_buf, index=False)
                st.download_button(
                    "⬇️ Download normalised CSV",
                    data=csv_buf.getvalue(),
                    file_name="sherlock_found.csv",
                    mime="text/csv",
                )

    # --- Tab 3: log URL extractor ----------------------------------------- #
    with tab_logs:
        st.write("Paste raw tool logs to pull out every unique URL.")
        log_text = st.text_area("Log text", height=240)
        if st.button("Extract URLs"):
            urls = ReportGenerator.extract_from_logs(log_text)
            if not urls:
                st.info("No URLs found.")
            else:
                st.success(f"Found {len(urls)} unique URL(s).")
                url_df = pd.DataFrame({"URL": urls})
                st.dataframe(url_df, use_container_width=True, hide_index=True)
                st.download_button(
                    "⬇️ Download URLs (JSON)",
                    data=json.dumps(urls, indent=2),
                    file_name="extracted_urls.json",
                    mime="application/json",
                )


if __name__ == "__main__":
    main()
