import { AvatarState, CheckInInput, DailyCheckIn } from '../models/check-in.model';
import { PetItem } from '../models/item.model';
import { addDays, daysBetween } from '../../shared/date';

export const GOALS = {
  sleepHours: 7.5,
  runningKm: 3,
  screenMaxHours: 3,
} as const;

/** Stat points lost per day without a check-in — the Pou-style "hunger". */
const DECAY_PER_DAY = 15;

export type StatKey = 'energy' | 'fitness' | 'nutrition' | 'mood' | 'screen';
export type PetStats = Record<StatKey, number>;

const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)));

export function statsFor(entry: CheckInInput): PetStats {
  return {
    energy: clamp(
      ((entry.sleep.durationHours - 4) / (GOALS.sleepHours - 4)) * 100 +
        (entry.sleep.feelingRested ? 10 : -10),
    ),
    fitness: clamp((entry.metrics.runningDistanceKm / GOALS.runningKm) * 100),
    nutrition: clamp(entry.food.qualityScore),
    mood: clamp(entry.mood.score * 10 + (entry.social.metWithFriends ? 10 : 0)),
    screen: clamp(100 - Math.max(0, entry.metrics.screenTimeHours - GOALS.screenMaxHours) * 20),
  };
}

export function decayStats(stats: PetStats, days: number): PetStats {
  const loss = Math.max(0, days) * DECAY_PER_DAY;
  return Object.fromEntries(
    Object.entries(stats).map(([key, value]) => [key, clamp(value - loss)]),
  ) as PetStats;
}

export function wellbeingOf(stats: PetStats): number {
  const values = Object.values(stats);
  return clamp(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function avatarStateFor(stats: PetStats): AvatarState {
  const wellbeing = wellbeingOf(stats);
  if (wellbeing < 40) return 'sick';
  if (stats.energy < 65) return 'sleepy';
  if (stats.mood < 50) return 'sad';
  if (wellbeing >= 70) return 'happy';
  return 'neutral';
}

/** State shown when there's no check-in for today yet — the pet slowly wilts. */
export function idleAvatarState(decayedStats: PetStats, daysSinceLastEntry: number): AvatarState {
  if (daysSinceLastEntry >= 3) return 'sick';
  if (wellbeingOf(decayedStats) < 40) return 'sad';
  return 'neutral';
}

export function moodLabel(score: number): string {
  if (score <= 2) return 'fatalnie';
  if (score <= 4) return 'słabo';
  if (score <= 6) return 'tak sobie';
  if (score <= 8) return 'całkiem spoko';
  return 'super';
}

/** Consecutive days ending today (or yesterday, so the streak isn't "lost" before today's entry). */
export function currentStreak(dates: ReadonlySet<string>, today: string): number {
  let day = dates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (dates.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function longestStreak(dates: ReadonlySet<string>): number {
  const sorted = [...dates].sort();
  let best = 0;
  let run = 0;
  sorted.forEach((date, i) => {
    run = i > 0 && daysBetween(sorted[i - 1], date) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

export const ITEMS: readonly PetItem[] = [
  {
    id: 'headband',
    name: 'Opaska sportowa',
    icon: '🎽',
    slot: 'head',
    requirement: 'Przebiegnij łącznie 10 km',
    target: 10,
  },
  {
    id: 'party-hat',
    name: 'Imprezowa czapeczka',
    icon: '🎉',
    slot: 'head',
    requirement: 'Spotkaj się ze znajomymi 3 razy',
    target: 3,
  },
  {
    id: 'nightcap',
    name: 'Szlafmyca',
    icon: '🌙',
    slot: 'head',
    requirement: `Śpij min. ${GOALS.sleepHours} h przez 3 noce`,
    target: 3,
  },
  {
    id: 'chef-hat',
    name: 'Czapka kucharza',
    icon: '🧑‍🍳',
    slot: 'head',
    requirement: 'Jedz zdrowo (80+) przez 3 dni',
    target: 3,
  },
  {
    id: 'crown',
    name: 'Korona',
    icon: '👑',
    slot: 'head',
    requirement: 'Dodawaj wpisy 5 dni z rzędu',
    target: 5,
  },
  {
    id: 'sunglasses',
    name: 'Okulary',
    icon: '😎',
    slot: 'face',
    requirement: 'Max 2 h ekranu przez 3 dni',
    target: 3,
  },
];

export function itemProgress(item: PetItem, checkIns: readonly DailyCheckIn[]): number {
  const count = (predicate: (c: DailyCheckIn) => boolean) => checkIns.filter(predicate).length;
  switch (item.id) {
    case 'headband':
      return checkIns.reduce((sum, c) => sum + c.metrics.runningDistanceKm, 0);
    case 'party-hat':
      return count((c) => c.social.metWithFriends);
    case 'nightcap':
      return count((c) => c.sleep.durationHours >= GOALS.sleepHours);
    case 'chef-hat':
      return count((c) => c.food.qualityScore >= 80);
    case 'crown':
      return longestStreak(new Set(checkIns.map((c) => c.date)));
    case 'sunglasses':
      return count((c) => c.metrics.screenTimeHours <= 2);
  }
}
