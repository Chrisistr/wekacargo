# Deploy (Render API + Netlify frontend)

**Render:** New Web Service or Blueprint → root `backend`, build `npm install`, start `npm start`, health `/api/health`. Set env vars in the dashboard (not from Git): `MONGODB_URI` (Atlas `mongodb+srv`, Atlas Network Access allow `0.0.0.0/0`), `JWT_SECRET` (or use `render.yaml` `generateValue`), `FRONTEND_URL`, M-Pesa vars, `MPESA_CALLBACK_URL` = `https://<service>.onrender.com/api/payments/callback`, `GOOGLE_CLIENT_ID`, optional `OPENROUTESERVICE_API_KEY`.

**Netlify:** Import repo; `netlify.toml` sets base `frontend`, publish `build`. Env: `REACT_APP_API_URL` = `https://<service>.onrender.com/api` (no slash after `api`), `REACT_APP_GOOGLE_CLIENT_ID` = same Web client ID. Redeploy after env changes (CRA bakes vars at build).

**Google OAuth:** Authorized JavaScript origins: Netlify URL + `http://localhost:3000`.

**Checks:** `GET /api/health` on Render; if the SPA gets HTML from API calls, fix `REACT_APP_API_URL` and rebuild Netlify.

Render free tier may sleep ~30s after idle.
