# Deploy WekaCargo (Netlify + Render)

Monorepo layout: `frontend/` (React), `backend/` (Express). MongoDB Atlas is external.

## 1. Deploy the API (Render)

1. Push this repo to GitHub (if it is not already).
2. In [Render](https://render.com) → **New** → **Blueprint** → connect the repo, or **Web Service** with:
   - **Root directory:** `backend`
   - **Build:** `npm install`
   - **Start:** `npm start`
   - **Health check path:** `/api/health`
3. Add **Environment** variables (same names as `backend/.env`, no file upload):

| Variable | Notes |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | Leave unset (Render sets it) |
| `MONGODB_URI` | Atlas connection string |
| `JWT_SECRET` | Strong random string (not the dev default) |
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

The repo already includes `netlify.toml` (build `frontend`, publish `frontend/build`).

1. [Netlify](https://app.netlify.com) → **Add new site** → **Import from Git** → pick this repo.
2. Netlify should detect `netlify.toml` (`base = "frontend"`).
3. **Site configuration → Environment variables** → add:

   - **`REACT_APP_API_URL`** = `https://<your-render-service>.onrender.com/api`  
     (must end with `/api`, no trailing slash after `api`)

4. Trigger **Deploy** (or push a commit). The React app bakes this in at build time.

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
