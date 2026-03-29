import { toast } from 'react-toastify';

/**
 * Resolves the API base URL for axios.
 * - Local dev: prefer relative "/api" so Create React App's package.json "proxy" forwards to the backend (no CORS, no hardcoded port).
 * - Production (e.g. Netlify): REACT_APP_API_URL must be the full backend URL (https://.../api). Relative "/api" on Netlify is broken because public/_redirects sends /* to index.html.
 */
export function resolveApiBaseURL(): string {
  const raw = process.env.REACT_APP_API_URL;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (trimmed !== '') {
    return trimmed.replace(/\/+$/, '');
  }
  return '/api';
}

let warnedSpaApiMisconfig = false;

/** Call when the API response looks like SPA HTML (Netlify misconfiguration or backend down). */
export function warnIfHtmlInsteadOfJson(data: unknown, requestUrl: string) {
  if (typeof data !== 'string') return;
  if (!data.includes('<!DOCTYPE') && !data.includes('<html')) return;
  if (warnedSpaApiMisconfig) return;
  warnedSpaApiMisconfig = true;
  const isNetlify =
    typeof window !== 'undefined' && window.location.hostname.includes('netlify');
  const msg = isNetlify
    ? 'API calls are returning the app page instead of JSON. In Netlify → Site configuration → Environment variables, set REACT_APP_API_URL to your deployed backend (e.g. https://your-api.onrender.com/api), then trigger a new deploy.'
    : 'API returned HTML instead of JSON. Check that the backend is running and REACT_APP_API_URL matches your server.';
  console.error('[api]', msg, { requestUrl });
  toast.error(msg, { autoClose: 12000 });
}
