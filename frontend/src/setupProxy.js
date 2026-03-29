/**
 * Only proxy /api to the Node backend. The simple "proxy" field in package.json
 * forwards *everything* (including /favicon.ico) and is easy to get wrong.
 * Port must match backend/.env PORT (default 5001).
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  const target = process.env.BACKEND_PROXY_TARGET || 'http://localhost:5001';
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
    })
  );
};
