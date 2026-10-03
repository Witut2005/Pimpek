// Forwards /api/* to the FastAPI backend, so the frontend keeps using relative /api URLs
// exactly like with the dev proxy (frontend/proxy.conf.json).
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!env.BACKEND_URL) return new Response('BACKEND_URL is not set', { status: 503 });

    const target = new URL(url.pathname + url.search, env.BACKEND_URL);
    const headers = new Headers(request.headers);
    // Skips ngrok's browser warning page when the backend runs behind a free tunnel.
    headers.set('ngrok-skip-browser-warning', '1');
    return fetch(new Request(target, { method: request.method, headers, body: request.body, redirect: 'manual' }));
  }
};
