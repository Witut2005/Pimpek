import { MoodEntry, MoodLevel } from '../models/journal.model';
import { addDays } from '../../shared/date';

/** Demo stories for the pitch: a good month, a rough patch, and a brand-new user. */
export type Scenario = 'good' | 'rough' | 'new';

export const SCENARIOS: readonly { id: Scenario; label: string; hint: string }[] = [
  { id: 'good', label: 'Dobry miesiąc', hint: 'przeważnie dobry nastrój' },
  { id: 'rough', label: 'Trudny miesiąc', hint: 'gorsze dni, przerwy we wpisach' },
  { id: 'new', label: 'Nowy użytkownik', hint: 'pusty dziennik' },
];

/** One seeded day. */
interface SeedEntry {
  daysAgo: number;
  mood: MoodLevel;
  note?: string;
}

const GOOD: readonly SeedEntry[] = [
  { daysAgo: 1, mood: 4, note: 'intensywny dzień, ale przyjemny' },
  { daysAgo: 2, mood: 5, note: 'nowa życiówka na 5 km!' },
  { daysAgo: 3, mood: 4, note: 'kino z ekipą' },
  { daysAgo: 4, mood: 2, note: 'deadline w pracy' },
  { daysAgo: 6, mood: 4, note: 'planszówki' },
  { daysAgo: 7, mood: 4 },
  { daysAgo: 8, mood: 5, note: 'obiad u rodziców' },
  { daysAgo: 10, mood: 3 },
  { daysAgo: 11, mood: 4, note: 'spacer z przyjaciółką' },
  { daysAgo: 13, mood: 3 },
  { daysAgo: 14, mood: 3, note: 'trochę za dużo kawy' },
  { daysAgo: 15, mood: 5, note: 'urodziny kolegi' },
  { daysAgo: 17, mood: 3 },
  { daysAgo: 18, mood: 2, note: 'kiepsko spałem' },
  { daysAgo: 20, mood: 3 },
  { daysAgo: 21, mood: 4, note: 'squash' },
  { daysAgo: 22, mood: 3 },
  { daysAgo: 24, mood: 2 },
  { daysAgo: 25, mood: 3 },
  { daysAgo: 27, mood: 3 },
];

// Gaps between entries: Pimpek just greets you warmly when you're back.
const ROUGH: readonly SeedEntry[] = [
  { daysAgo: 3, mood: 2, note: 'zarwana noc, kawa za kawą' },
  { daysAgo: 7, mood: 1, note: 'nic mi się nie chce' },
  { daysAgo: 8, mood: 3, note: 'kawa z sąsiadką' },
  { daysAgo: 12, mood: 2 },
  { daysAgo: 16, mood: 3 },
  { daysAgo: 21, mood: 2 },
];

const seedFor = (scenario: Scenario): readonly SeedEntry[] =>
  scenario === 'good' ? GOOD : scenario === 'rough' ? ROUGH : [];

export function buildScenarioEntries(scenario: Scenario, today: string): MoodEntry[] {
  return seedFor(scenario).map(({ daysAgo, mood, note }) => ({
    date: addDays(today, -daysAgo),
    mood,
    ...(note && { note }),
  }));
}
