/** Every key the app keeps in localStorage, so "delete my data" can wipe them all. */
export const KEYS = {
  journal: 'pimpek.moods',
  settings: 'pimpek.settings',
  skin: 'pimpek.skin',
  ai: 'pimpek.ai',
} as const;

/**
 * Left behind by older versions: the five-level journal, daily check-ins, the leaf wallet, the removed
 * wearable / Strava sync and demo mode.
 */
export const LEGACY_KEYS = {
  fiveLevelJournal: 'pimpek.journal',
  checkIns: 'pimpek.checkIns',
  sources: 'pimpek.sources',
  wearable: 'pimpek.wearable',
  strava: 'pimpek.strava',
  wallet: 'pimpek.wallet',
  scenario: 'pimpek.scenario',
  clock: 'pimpek.clock',
} as const;

/** localStorage that never throws (private mode, blocked storage) — the app must not crash on it. */
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
