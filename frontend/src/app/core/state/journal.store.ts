import { computed, effect, Injectable, signal } from '@angular/core';
import { fromFiveLevels, MoodEntry, MoodLevel } from '../models/journal.model';
import { KEYS, LEGACY_KEYS, readJson, removeKey, writeJson } from '../../shared/storage';

const newestFirst = (a: MoodEntry, b: MoodEntry) => b.date.localeCompare(a.date);

/** Older journal versions kept several timed entries a day. */
interface StoredEntry extends MoodEntry {
  createdAt?: string;
}

/** What the oldest versions stored per day; only the mood (1–10) and the note carry over. */
interface LegacyCheckIn {
  date: string;
  createdAt: string;
  mood?: { score?: number };
  note?: string;
}

/** One entry per day — where a day had several, the last one written stands for it. */
function onePerDay(list: readonly StoredEntry[]): MoodEntry[] {
  const days = new Map<string, StoredEntry>();
  for (const entry of list) {
    const kept = days.get(entry.date);
    if (!kept || (entry.createdAt ?? '') > (kept.createdAt ?? '')) days.set(entry.date, entry);
  }
  return [...days.values()].map(({ date, mood, note }) => ({ date, mood, ...(note && { note }) })).sort(newestFirst);
}

/**
 * Entries of the five-level journal and daily check-ins from before it move to the four-level scale,
 * so nobody loses their history. The old wearable / Strava caches have no use any more and are dropped.
 */
function migrateLegacy(): StoredEntry[] {
  const fiveLevel = readJson<StoredEntry[]>(LEGACY_KEYS.fiveLevelJournal, []);
  const checkIns = readJson<LegacyCheckIn[]>(LEGACY_KEYS.checkIns, []);
  Object.values(LEGACY_KEYS).forEach(removeKey);
  return [
    ...checkIns
      .filter((c) => c.date && typeof c.mood?.score === 'number')
      .map((c) => ({
        date: c.date,
        createdAt: c.createdAt,
        mood: Math.min(4, Math.max(1, Math.ceil((c.mood!.score! * 4) / 10))) as MoodLevel,
        ...(c.note && { note: c.note }),
      })),
    ...fiveLevel.map((e) => ({ ...e, mood: fromFiveLevels(e.mood) })),
  ];
}

function load(): MoodEntry[] {
  return onePerDay(readJson<StoredEntry[] | null>(KEYS.journal, null) ?? migrateLegacy());
}

/** The mood journal, one entry per day, kept on this device only (localStorage). */
@Injectable({ providedIn: 'root' })
export class JournalStore {
  /** Newest day first. */
  readonly entries = signal<MoodEntry[]>(load());

  readonly byDate = computed(() => new Map(this.entries().map((e) => [e.date, e])));

  constructor() {
    effect(() => writeJson(KEYS.journal, this.entries()));
  }

  /**
   * Writes the entry for its day, replacing whatever that day had. `from` is the day it used to
   * belong to, when an edit moved it to another date.
   */
  save({ date, mood, note }: MoodEntry, from?: string): MoodEntry {
    const entry: MoodEntry = { date, mood, ...(note && { note }) };
    this.entries.update((list) =>
      [entry, ...list.filter((e) => e.date !== date && e.date !== from)].sort(newestFirst),
    );
    return entry;
  }

  remove(date: string): void {
    this.entries.update((list) => list.filter((e) => e.date !== date));
  }

  replace(entries: readonly MoodEntry[]): void {
    this.entries.set(onePerDay(entries));
  }
}
