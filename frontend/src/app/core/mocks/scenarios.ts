import { CheckInInput, DailyCheckIn } from '../models/check-in.model';
import { SourceId, WearableDay } from '../models/metrics.model';
import { buildCompanionReaction } from '../services/companion-reaction';
import { GOALS, moodLabel } from '../state/pet-rules';
import { addDays, daysBetween } from '../../shared/date';

/** Demo stories for the pitch: a good streak, a rough patch, and a brand-new user. */
export type Scenario = 'good' | 'rough' | 'new';

export const SCENARIOS: readonly { id: Scenario; label: string; hint: string }[] = [
  { id: 'good', label: 'Dobry tydzień', hint: 'seria 4 dni, dziś wpis odblokuje koronę' },
  { id: 'rough', label: 'Trudny tydzień', hint: 'mało snu, 3 dni bez wpisu' },
  { id: 'new', label: 'Nowy użytkownik', hint: 'zero danych, bez zegarka' },
];

/** FNV-1a hash → 0..1, so the same day always gets the same fake numbers. */
function noise(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

const toFiveMinutes = (hours: number) => Math.round(hours * 12) / 12;

/**
 * What the wearable "measured" on `date`. `anchor` is the day the scenario was loaded:
 * it gets fixed headline numbers so the pitch always tells the same story.
 */
export function wearableDay(
  scenario: Scenario,
  date: string,
  today: string,
  anchor: string,
  source: SourceId,
): WearableDay & { sleepHours: number } {
  const n = (salt: string) => noise(`${scenario}:${date}:${salt}`);
  const daysAgo = daysBetween(date, today);
  let sleepHours: number;
  let steps: number;
  let restingHr: number;
  let screenHours: number;

  if (scenario === 'rough') {
    sleepHours = 4.9 + n('sleep') * 1.7;
    steps = 1800 + n('steps') * 4200;
    restingHr = 66 + n('hr') * 7;
    screenHours = 5 + n('screen') * 3.5;
  } else {
    const improving = (Math.max(0, 14 - daysAgo) / 14) * 0.35;
    sleepHours = 6.5 + n('sleep') * 1.6 + improving;
    steps = 5500 + n('steps') * 6500;
    restingHr = 55 + n('hr') * 5;
    screenHours = 1.5 + n('screen') * 4;
  }

  // The phone agrees with what the seeded check-in says about that day.
  const seeded = seedFor(scenario).find((s) => s.daysAgo === daysAgo);
  if (seeded) screenHours = seeded.screen;

  if (date === anchor) {
    sleepHours = scenario === 'rough' ? 5.4 : 7.85;
    steps = scenario === 'rough' ? 2100 : 9400;
    screenHours = scenario === 'rough' ? 6 : 2;
  }

  const complete = date !== today;
  return {
    date,
    source,
    sleepHours: toFiveMinutes(sleepHours),
    // The day isn't over: only part of the steps are in.
    steps: Math.round(complete ? steps : steps * 0.45),
    restingHr: Math.round(restingHr),
    // Half-hour steps, like the check-in slider, so "Użyj" compares like with like.
    screenHours: Math.round(screenHours * 2) / 2,
    complete,
  };
}

interface SeedDay {
  daysAgo: number;
  mood: number;
  food: number;
  screen: number;
  km: number;
  social?: string;
  note?: string;
  foodNote?: string;
}

// Longest run of consecutive days is 4, so today's entry unlocks the crown 👑.
const GOOD: readonly SeedDay[] = [
  { daysAgo: 1, mood: 8, food: 75, screen: 3.5, km: 3.5, social: 'szybka kawa ze znajomymi', note: 'intensywny dzień, ale przyjemny', foodNote: 'dobry obiad, ale wjechała też czekolada' },
  { daysAgo: 2, mood: 9, food: 85, screen: 2.5, km: 5, note: 'nowa życiówka na 5 km!', foodNote: 'sałatka z kurczakiem i owoce' },
  { daysAgo: 3, mood: 6, food: 60, screen: 5, km: 0, social: 'kino z ekipą', foodNote: 'pizza na mieście' },
  { daysAgo: 4, mood: 5, food: 45, screen: 6.5, km: 0, note: 'deadline w pracy', foodNote: 'fast food w biegu' },
  { daysAgo: 6, mood: 7, food: 82, screen: 1.5, km: 4, social: 'planszówki', foodNote: 'domowe curry' },
  { daysAgo: 7, mood: 7, food: 70, screen: 3, km: 2.5 },
  { daysAgo: 8, mood: 8, food: 88, screen: 2.5, km: 0, social: 'obiad u rodziców' },
  { daysAgo: 10, mood: 6, food: 65, screen: 4, km: 3 },
  { daysAgo: 11, mood: 7, food: 72, screen: 3, km: 0, social: 'spacer z przyjaciółką' },
  { daysAgo: 13, mood: 5, food: 55, screen: 5.5, km: 0 },
  { daysAgo: 14, mood: 6, food: 68, screen: 4, km: 2 },
  { daysAgo: 15, mood: 7, food: 78, screen: 2, km: 0, social: 'urodziny kolegi' },
  { daysAgo: 17, mood: 6, food: 62, screen: 4.5, km: 3 },
  { daysAgo: 18, mood: 5, food: 50, screen: 6, km: 0 },
  { daysAgo: 20, mood: 6, food: 66, screen: 3.5, km: 0 },
  { daysAgo: 21, mood: 7, food: 74, screen: 3, km: 4, social: 'squash' },
  { daysAgo: 22, mood: 6, food: 58, screen: 5, km: 0 },
  { daysAgo: 24, mood: 5, food: 52, screen: 5.5, km: 0 },
  { daysAgo: 25, mood: 6, food: 64, screen: 4, km: 2.5 },
  { daysAgo: 27, mood: 6, food: 60, screen: 4.5, km: 0 },
];

// Last entry 3 days ago: Pimpek has been neglected and the wearable shows short nights.
// The food notes tell of skipped meals, so the AI profile has a story to notice.
const ROUGH: readonly SeedDay[] = [
  { daysAgo: 3, mood: 4, food: 40, screen: 7, km: 0, note: 'zarwana noc, kawa za kawą', foodNote: 'drożdżówka i energetyk, obiadu nie było' },
  { daysAgo: 4, mood: 5, food: 50, screen: 6, km: 0, foodNote: 'tylko kawa do południa, obiad dopiero wieczorem' },
  { daysAgo: 7, mood: 3, food: 35, screen: 8, km: 0, note: 'nic mi się nie chce', foodNote: 'prawie nic, brak apetytu' },
  { daysAgo: 8, mood: 5, food: 55, screen: 5.5, km: 1.5, social: 'kawa z sąsiadką', foodNote: 'śniadanie pominięte' },
  { daysAgo: 12, mood: 4, food: 45, screen: 7.5, km: 0 },
  { daysAgo: 16, mood: 6, food: 60, screen: 5, km: 2 },
  { daysAgo: 21, mood: 5, food: 48, screen: 6.5, km: 0 },
];

const seedFor = (scenario: Scenario): readonly SeedDay[] =>
  scenario === 'good' ? GOOD : scenario === 'rough' ? ROUGH : [];

export function buildScenarioCheckIns(scenario: Scenario, today: string, source: SourceId): DailyCheckIn[] {
  return seedFor(scenario).map(({ daysAgo, mood, food, screen, km, social, note, foodNote }) => {
    const date = addDays(today, -daysAgo);
    const measured = wearableDay(scenario, date, today, today, source);
    const input: CheckInInput = {
      date,
      mood: { score: mood, label: moodLabel(mood) },
      sleep: { durationHours: measured.sleepHours, feelingRested: measured.sleepHours >= 7 },
      food: { qualityScore: food, note: foodNote },
      metrics: { runningDistanceKm: km, screenTimeHours: screen, steps: measured.steps },
      social: { metWithFriends: !!social, context: social },
      note,
    };
    return {
      ...input,
      id: `entry-${date}`,
      createdAt: new Date(`${date}T21:00:00`).toISOString(),
      companionReaction: buildCompanionReaction(input, GOALS),
    };
  });
}
