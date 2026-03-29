# Deploy WekaCargo (Netlify + Render)

Monorepo layout: `frontend/` (React), `backend/` (Express). MongoDB Atlas is external.

## 1. Deploy the API (Render)

1. Push this repo to GitHub (if it is not already).
2. In [Render](https://render.com) → **New** → **Blueprint** → connect the repo, or **Web Service** with:
   - **Root directory:** `backend`
   - **Build:** `npm install`
   - **Start:** `npm start`
   - **Health check path:** `/api/health`
3. Add **Environment** variables (same names as `backend/.env`, no file upload). **Render never loads `backend/.env` from Git** — if `JWT_SECRET` is missing, the app exits immediately.

| Variable | Notes |
|----------|--------|
| `NODE_ENV` | `production` (also set in `render.yaml`) |
| `PORT` | Leave unset (Render sets it) |
| `MONGODB_URI` | **Required on Render.** Atlas `mongodb+srv://...` (copy from Atlas → Connect → Drivers). Without it, the app defaults to `localhost` and crashes. In Atlas → **Network Access**, add **`0.0.0.0/0`** (or Render egress) so the cloud can connect. |
| `JWT_SECRET` | **Required.** Set in dashboard → **Environment** → add `JWT_SECRET` with a long random string, *or* redeploy after pulling the repo’s `render.yaml` (it uses `generateValue: true` for `JWT_SECRET`). |
| `FRONTEND_URL` | `https://wekacargo.netlify.app` (or your custom domain) |
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` / `MPESA_SHORTCODE` / `MPESA_PASSKEY` | Sandbox or live Daraja credentials |
| `MPESA_CALLBACK_URL` | **`https://<your-render-service>.onrender.com/api/payments/callback`** (replace with your real Render URL) |
| `GOOGLE_CLIENT_ID` | If you use Google sign-in |
| `OPENROUTESERVICE_API_KEY` | Optional |

4. Deploy and copy the service URL, e.g. `https://wekacargo-api.onrender.com`.

**MongoDB Atlas:** Network Access → allow **`0.0.0.0/0`** (or Render’s egress IPs) so the cloud API can connect.

**M-Pesa:** Production apps need **live** Daraja credentials and a **public HTTPS** callback; the Render URL above satisfies HTTPS. Sandbox still works for testing if you keep sandbox keys and use sandbox amounts/phones.

---

## 2. Deploy the frontend (Netlify)

The repo includes `netlify.toml`: **base** `frontend`, **publish** `build`, **Node 18**.

### New site from Git

1. [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project** → GitHub → authorize → select **`wekacargo`** (this repo).
2. Netlify reads `netlify.toml` automatically. You should see:
   - **Base directory:** `frontend` (from config)
   - **Build command:** `npm run build`
   - **Publish directory:** `build` (relative to `frontend`, so output is `frontend/build`)
3. **Before** the first successful production build, add environment variables:

   **Site configuration** (gear) → **Environment variables** → **Add a variable** → scope **Production** (and **Deploy previews** if you want previews to hit the real API).

   | Key | Value |
   |-----|--------|
   | `REACT_APP_API_URL` | `https://<your-render-service>.onrender.com/api` |
   | `REACT_APP_GOOGLE_CLIENT_ID` | Same as backend `GOOGLE_CLIENT_ID` (Web client ID) |

   **Important:** `REACT_APP_API_URL` must end with **`/api`** and **not** have another slash after `api` (example: `https://wekacargo-api.onrender.com/api`).

4. **Deploy site**. If the site already failed once, open **Deploys** → **Trigger deploy** → **Clear cache and deploy site** after saving env vars (Create React App reads env only at build time).

### Site already exists (e.g. wekacargo.netlify.app)

1. **Site configuration** → **Build & deploy** → **Continuous deployment**: confirm the repo/branch is connected.
2. **Environment variables**: add or fix `REACT_APP_API_URL` and `REACT_APP_GOOGLE_CLIENT_ID` as above.
3. **Deploys** → **Trigger deploy** → **Clear cache and deploy site**.

### Backend CORS

On Render, set **`FRONTEND_URL`** to your exact Netlify URL, e.g. `https://wekacargo.netlify.app` (no trailing slash). The API already allows that host in code; unknown production origins are blocked by CORS.

---

## 3. Google Sign-In (if used)

In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → your OAuth client:

- **Authorized JavaScript origins:** `https://wekacargo.netlify.app` (and `http://localhost:3000` for local dev).
- **Authorized redirect URIs:** same origins as required by your flow.

---

## 4. Quick checks

- Open `https://<render-host>/api/health` → should return JSON with database status.
- Open the Netlify site → login/register; if API errors mention HTML, `REACT_APP_API_URL` is wrong or missing and you need a **new** Netlify deploy after fixing it.

---

## Free tier notes

- **Render** free services **spin down** after idle; first request can take ~30s.
- For always-on or faster cold starts, upgrade the Render service or use another host (Railway, Fly.io, VPS) with the same env vars and `npm start` in `backend/`.
