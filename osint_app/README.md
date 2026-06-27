# 🕵️ OSINT Investigator

A Streamlit app for **username enumeration** and **evidence reporting** from public
sources. It checks whether a username exists across ~24 platforms, ingests
[Sherlock](https://github.com/sherlock-project/sherlock) `--csv` output, and extracts
URLs from raw tool logs — then produces a downloadable Markdown / CSV evidence report.

> ⚠️ **Use responsibly.** This tool only queries publicly available profile pages.
> Only investigate targets you are authorised to.

## Features

| Tab | What it does |
| --- | --- |
| 🔎 **Username Search** | Concurrent HTTP checks across many platforms with live progress, summary metrics, and an evidence table. |
| 📥 **Import Sherlock CSV** | Upload Sherlock's native `--csv` output; normalises it to "found accounts only". |
| 📝 **Log URL Extractor** | Paste raw logs from any tool and pull out every unique URL via regex. |

All results can be exported as a **Markdown report** or **CSV evidence** file.

## Quickstart

```bash
cd osint_app
python -m venv .venv && source .venv/bin/activate   # optional
pip install -r requirements.txt
streamlit run app.py
```

Then open the URL Streamlit prints (default <http://localhost:8501>).

## Using Sherlock together with this app

For higher-fidelity results across hundreds of sites, run Sherlock with structured
output and import the CSV in the **Import Sherlock CSV** tab:

```bash
pip install sherlock-project
sherlock TARGET --csv --folderoutput ./results
```

## How detection works

Each site in `SITES` (in `app.py`) is checked one of two ways:

- **`status_code`** — a non-`200` response means the account does not exist.
- **`message`** — the page returns `200` but contains a known "not found" string.

Detection is best-effort: some platforms aggressively rate-limit or cloak responses
to non-browser clients, which can produce false negatives/positives. Treat results as
leads to verify, not as proof. Tune the platform list, concurrency, and timeout from
the sidebar.

## Notes

- This is a standalone Python/Streamlit app and is **not** part of the GitHub Pages
  site (GitHub Pages only serves static files; Streamlit needs a Python server).
  Deploy it to [Streamlit Community Cloud](https://streamlit.io/cloud), a container,
  or run it locally.
