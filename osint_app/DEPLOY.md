# Deploying to Streamlit Community Cloud

This app is ready to deploy to **[Streamlit Community Cloud](https://share.streamlit.io)**
(free, public, hosted by Streamlit). It deploys directly from this GitHub repo — no
servers to manage.

## One-time deploy (≈2 minutes)

1. Go to **<https://share.streamlit.io>** and sign in with the **GitHub account that
   owns `cjaynyc/cjaynyc.github.io`** (so it can read the repo).
2. Click **"Create app" → "Deploy a public app from GitHub"**.
3. Fill in the form exactly:
   | Field | Value |
   | --- | --- |
   | **Repository** | `cjaynyc/cjaynyc.github.io` |
   | **Branch** | `claude/osint-streamlit-app-twdfmk` |
   | **Main file path** | `osint_app/app.py` |
   | **App URL** | pick any name, e.g. `cjaynyc-osint` |
4. (Optional) Under **Advanced settings**, set **Python version** to **3.12**.
5. Click **Deploy**.

Streamlit reads `osint_app/requirements.txt`, installs the pinned dependencies, and
gives you a permanent URL like `https://cjaynyc-osint.streamlit.app`.

## After you merge to `main`

Once this branch is merged, change the deployed app's **Branch** to `main` in the
app's **Settings → General** (or redeploy). Every push to that branch then
auto-redeploys the app.

## Notes & limits

- **Public by default.** Community Cloud apps are publicly reachable. Don't put
  secrets or private targets in the UI. For private/auth-gated hosting, use Streamlit
  in a container (see below) or Streamlit's paid tiers.
- **Outbound requests:** the live username checker makes HTTP requests from
  Streamlit's servers. Some platforms rate-limit cloud IP ranges more aggressively
  than home IPs, so expect a few more false negatives than running locally. The
  **Import Sherlock CSV** tab sidesteps this.
- **Resource limits:** the free tier sleeps after inactivity and has ~1 GB RAM —
  plenty for this app.

## Alternative: deploy as a container (any cloud)

If you'd rather run it on your own infrastructure (Cloud Run, Fly.io, a VPS, etc.):

```bash
# from repo root
docker build -f osint_app/Dockerfile -t osint-investigator osint_app
docker run -p 8501:8501 osint-investigator
```

Then open <http://localhost:8501> (or your host's URL).
