import { HttpInterceptorFn } from '@angular/common/http';

/** Not in storage.ts KEYS on purpose: "reset demo" must not orphan the backend's connections. */
const USER_ID_KEY = 'pimpek.userId';

let cached: string | undefined;

/**
 * This browser's identity for the backend, made up on first use and kept in localStorage,
 * so people trying the app don't share one Garmin/Fitatu connection. A placeholder for real auth.
 */
export function userId(): string {
  if (cached) return cached;
  try {
    cached = localStorage.getItem(USER_ID_KEY) ?? undefined;
  } catch {
    // Storage unavailable: one id for this tab's lifetime.
  }
  if (!cached) {
    cached = newId();
    try {
      localStorage.setItem(USER_ID_KEY, cached);
    } catch {
      // Same as above.
    }
  }
  return cached;
}

// randomUUID needs a secure context; plain http on a LAN address (testing on a phone) isn't one.
function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

/** Sends the browser's user id with every call to our backend (`/api`), and only there. */
export const userIdInterceptor: HttpInterceptorFn = (req, next) =>
  req.url.startsWith('/api/')
    ? next(req.clone({ setHeaders: { 'X-User-Id': userId() } }))
    : next(req);
