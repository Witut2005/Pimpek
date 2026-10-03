/** Every key the app keeps in localStorage, so "reset demo" can wipe them all. */
export const KEYS = {
  checkIns: 'pimpek.checkIns',
  settings: 'pimpek.settings',
  sources: 'pimpek.sources',
  wearable: 'pimpek.wearable',
  wallet: 'pimpek.wallet',
  equipped: 'pimpek.equipped',
  scenario: 'pimpek.scenario',
  clock: 'pimpek.clock',
  skin: 'pimpek.skin',
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
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  } catch {
    // Nothing to clear.
  }
}
