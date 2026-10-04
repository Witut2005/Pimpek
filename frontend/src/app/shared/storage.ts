/** Every key the app keeps in localStorage, so "reset demo" can wipe them all. */
export const KEYS = {
  journal: 'pimpek.journal',
  settings: 'pimpek.settings',
  scenario: 'pimpek.scenario',
  clock: 'pimpek.clock',
  skin: 'pimpek.skin',
  ai: 'pimpek.ai',
} as const;

/** Left behind by older versions: daily check-ins, the leaf wallet and the removed wearable / Strava sync. */
export const LEGACY_KEYS = {
  checkIns: 'pimpek.checkIns',
  sources: 'pimpek.sources',
  wearable: 'pimpek.wearable',
  strava: 'pimpek.strava',
  wallet: 'pimpek.wallet',
} as const;

/** localStorage that never throws (private mode, blocked storage) — the demo must not crash on it. */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the app keeps working in memory.
  }
}

export function clearAll(): void {
  try {
    [...Object.values(KEYS), ...Object.values(LEGACY_KEYS)].forEach((key) => localStorage.removeItem(key));
  } catch {
    // Nothing to clear.
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to remove.
  }
}
