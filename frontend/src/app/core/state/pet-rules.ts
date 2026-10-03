import { AvatarState, CheckInInput, DailyCheckIn } from '../models/check-in.model';
import { Badge, PetItem } from '../models/item.model';
import { Nutrients } from '../models/meals.model';
import { WearableDay } from '../models/metrics.model';
import { DEFAULT_GOALS, Goals } from '../models/settings.model';
import { addDays, daysBetween } from '../../shared/date';
import { IconName } from '../../shared/icon/icon';

/** Defaults for places that have no user settings at hand (seed data, item texts). */
export const GOALS = DEFAULT_GOALS;

/** Stat points lost per day without a check-in — the Pou-style "hunger". */
const DECAY_PER_DAY = 15;

export type StatKey = 'energy' | 'fitness' | 'nutrition' | 'mood' | 'screen';
export type PetStats = Record<StatKey, number>;
export const STAT_KEYS: readonly StatKey[] = ['energy', 'nutrition', 'fitness', 'mood', 'screen'];

const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)));

export function energyScore(sleepHours: number, rested: boolean | undefined, goals: Goals): number {
  const restedBonus = rested === undefined ? 0 : rested ? 10 : -10;
  return clamp(((sleepHours - 4) / (goals.sleepHours - 4)) * 100 + restedBonus);
}

/** Steps when a wearable measured them, running km otherwise — whichever paints the better day. */
export function fitnessScore(steps: number | undefined, runningKm: number, goals: Goals): number {
  const fromKm = (runningKm / goals.runningKm) * 100;
  const fromSteps = steps === undefined ? 0 : (steps / goals.steps) * 100;
  return clamp(Math.max(fromKm, fromSteps));
}

export function statsFor(entry: CheckInInput, goals: Goals = GOALS): PetStats {
  return {
    energy: energyScore(entry.sleep.durationHours, entry.sleep.feelingRested, goals),
    fitness: fitnessScore(entry.metrics.steps, entry.metrics.runningDistanceKm, goals),
    nutrition: clamp(entry.food.qualityScore),
    mood: clamp(entry.mood.score * 10 + (entry.social.metWithFriends ? 10 : 0)),
    screen: clamp(100 - Math.max(0, entry.metrics.screenTimeHours - goals.screenMaxHours) * 20),
  };
}

/**
 * The check-in is the source of truth: the user typed it in, using the watch only as a hint.
 * The wearable just fills in what the form never asks for — the step count.
 */
export function withWearable<T extends CheckInInput>(entry: T, wearable: WearableDay | undefined): T {
  if (!wearable || entry.metrics.steps !== undefined) return entry;
  return { ...entry, metrics: { ...entry.metrics, steps: wearable.steps } };
}

/**
 * The part of the stats a wearable alone can tell, before any check-in for the day.
 * No sleep recorded (watch off overnight) means no energy reading — not zero energy.
 */
export function measuredStats(
  wearable: WearableDay,
  goals: Goals,
): Partial<Pick<PetStats, 'energy' | 'fitness'>> {
  const fitness = fitnessScore(wearable.steps, wearable.runningKm ?? 0, goals);
  if (wearable.sleepHours === undefined) return { fitness };
  return { energy: energyScore(wearable.sleepHours, undefined, goals), fitness };
}

export function decayStats(stats: PetStats, days: number): PetStats {
  const loss = Math.max(0, days) * DECAY_PER_DAY;
  return Object.fromEntries(
    Object.entries(stats).map(([key, value]) => [key, clamp(value - loss)]),
  ) as PetStats;
}

export function wellbeingOf(stats: Partial<PetStats>): number {
  const values = Object.values(stats);
  return values.length ? clamp(values.reduce((sum, v) => sum + v, 0) / values.length) : 0;
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

export function foodLabel(score: number): string {
  if (score < 30) return 'raczej fast food';
  if (score < 60) return 'tak sobie';
  if (score < 80) return 'nieźle';
  return 'zdrowo i kolorowo';
}

/**
 * A first guess for the food slider from the diary — the user still has the last word.
 * Protein, fibre and regular meals push it up; sugar-heavy days and very low or very high
 * intake pull it down. Lands on the slider's step of 5, between 25 and 90.
 */
export function foodScoreFromMeals(totals: Nutrients, mealCount: number): number {
  if (!totals.kcal) return 50;
  const energyShare = (grams: number) => (grams * 4) / totals.kcal;
  const protein = energyShare(totals.protein);
  const sugars = energyShare(totals.sugars);
  let score = 50;
  score += protein >= 0.2 ? 15 : protein >= 0.15 ? 8 : 0;
  score += totals.fiber >= 25 ? 15 : totals.fiber >= 15 ? 8 : 0;
  score -= sugars > 0.25 ? 15 : sugars > 0.15 ? 5 : 0;
  score += mealCount >= 3 ? 10 : 0;
  if (totals.kcal < 1200 || totals.kcal > 3200) score -= 10;
  return Math.round(clamp(score) / 5) * 5;
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

// ---- wardrobe: rewards for habits, extras from the shop ----

export const ITEMS: readonly PetItem[] = [
  { id: 'headband', name: 'Opaska sportowa', icon: '🎽', slot: 'head', kind: 'reward', requirement: 'Przebiegnij łącznie 10 km', target: 10 },
  { id: 'party-hat', name: 'Imprezowa czapeczka', icon: '🎉', slot: 'head', kind: 'reward', requirement: 'Spotkaj się ze znajomymi 3 razy', target: 3 },
  { id: 'nightcap', name: 'Szlafmyca', icon: '🌙', slot: 'head', kind: 'reward', requirement: 'Wyśpij się 3 noce (cel snu)', target: 3 },
  { id: 'chef-hat', name: 'Czapka kucharza', icon: '🧑‍🍳', slot: 'head', kind: 'reward', requirement: 'Jedz zdrowo (80+) przez 3 dni', target: 3 },
  { id: 'crown', name: 'Korona', icon: '👑', slot: 'head', kind: 'reward', requirement: 'Dodawaj wpisy 5 dni z rzędu', target: 5 },
  { id: 'sunglasses', name: 'Okulary', icon: '😎', slot: 'face', kind: 'reward', requirement: 'Max 2 h ekranu przez 3 dni', target: 3 },
  { id: 'bow-tie', name: 'Muszka', icon: '🎀', slot: 'neck', kind: 'shop', requirement: 'Ze sklepiku', target: 1, price: 20 },
  { id: 'flower', name: 'Kwiatek', icon: '🌼', slot: 'head', kind: 'shop', requirement: 'Ze sklepiku', target: 1, price: 25 },
  { id: 'scarf', name: 'Szalik', icon: '🧣', slot: 'neck', kind: 'shop', requirement: 'Ze sklepiku', target: 1, price: 30 },
  { id: 'round-glasses', name: 'Okularki', icon: '👓', slot: 'face', kind: 'shop', requirement: 'Ze sklepiku', target: 1, price: 35 },
];

export function itemProgress(item: PetItem, checkIns: readonly DailyCheckIn[], goals: Goals = GOALS): number {
  const count = (predicate: (c: DailyCheckIn) => boolean) => checkIns.filter(predicate).length;
  switch (item.id) {
    case 'headband':
      return checkIns.reduce((sum, c) => sum + c.metrics.runningDistanceKm, 0);
    case 'party-hat':
      return count((c) => c.social.metWithFriends);
    case 'nightcap':
      return count((c) => c.sleep.durationHours >= goals.sleepHours);
    case 'chef-hat':
      return count((c) => c.food.qualityScore >= 80);
    case 'crown':
      return longestStreak(new Set(checkIns.map((c) => c.date)));
    case 'sunglasses':
      return count((c) => c.metrics.screenTimeHours <= 2);
    default:
      return 0;
  }
}

// ---- stickers: achievements that only decorate the album ----

export const BADGES: readonly Badge[] = [
  { id: 'first-entry', name: 'Pierwszy wpis', icon: '🌱', description: 'Opowiedz Pimpkowi o swoim dniu' },
  { id: 'connected', name: 'Na łączach', icon: '⌚', description: 'Połącz zegarek lub pierścień' },
  { id: 'week', name: 'Tydzień razem', icon: '🗓️', description: '7 dni z wpisem z rzędu' },
  { id: 'sleepyhead', name: 'Śpioszek', icon: '😴', description: '5 nocy z celem snu' },
  { id: 'walker', name: 'Wędrowiec', icon: '🥾', description: 'Dzień z 10 000 kroków' },
  { id: 'social', name: 'Dusza towarzystwa', icon: '🫶', description: '5 spotkań z ludźmi' },
  { id: 'detox', name: 'Cyfrowy detoks', icon: '📵', description: '3 dni z max 2 h ekranu' },
  { id: 'greens', name: 'Zielony talerz', icon: '🥗', description: '5 dni zdrowego jedzenia' },
];

export interface BadgeContext {
  checkIns: readonly DailyCheckIn[];
  wearable: readonly WearableDay[];
  connected: boolean;
  goals: Goals;
}

export function badgeEarned(id: string, ctx: BadgeContext): boolean {
  const { checkIns, wearable, goals } = ctx;
  const count = (predicate: (c: DailyCheckIn) => boolean) => checkIns.filter(predicate).length;
  switch (id) {
    case 'first-entry':
      return checkIns.length > 0;
    case 'connected':
      return ctx.connected;
    case 'week':
      return longestStreak(new Set(checkIns.map((c) => c.date))) >= 7;
    case 'sleepyhead':
      return wearable.filter((w) => (w.sleepHours ?? 0) >= goals.sleepHours).length >= 5;
    case 'walker':
      return wearable.some((w) => w.steps >= 10_000);
    case 'social':
      return count((c) => c.social.metWithFriends) >= 5;
    case 'detox':
      return count((c) => c.metrics.screenTimeHours <= 2) >= 3;
    case 'greens':
      return count((c) => c.food.qualityScore >= 80) >= 5;
    default:
      return false;
  }
}

// ---- daily quest & leaves (the soft currency) ----

export const QUEST_REWARD = 5;

export interface Quest {
  stat: StatKey;
  icon: IconName;
  text: string;
}

const QUESTS: Record<StatKey, Omit<Quest, 'stat'>> = {
  energy: { icon: 'moon', text: 'Połóż się dziś przed 23:00' },
  fitness: { icon: 'steps', text: 'Krótki spacer, choć 20 minut' },
  nutrition: { icon: 'apple', text: 'Zjedz dziś coś zielonego' },
  mood: { icon: 'heart', text: 'Napisz do kogoś bliskiego' },
  screen: { icon: 'phone', text: 'Godzina bez telefonu przed snem' },
};

/** One small, doable thing — always aimed at the weakest need we actually know about. */
export function questFor(stats: PetStats, known: ReadonlySet<StatKey> = new Set(STAT_KEYS)): Quest {
  const candidates = STAT_KEYS.filter((key) => known.has(key));
  const pool = candidates.length ? candidates : STAT_KEYS;
  const weakest = pool.reduce((low, key) => (stats[key] < stats[low] ? key : low), pool[0]);
  return { stat: weakest, ...QUESTS[weakest] };
}

/** 10 for showing up, +5 for every goal met — capped so nobody farms leaves. */
export function leavesFor(entry: CheckInInput, goals: Goals): number {
  const met = [
    entry.sleep.durationHours >= goals.sleepHours,
    (entry.metrics.steps ?? 0) >= goals.steps || entry.metrics.runningDistanceKm >= goals.runningKm,
    entry.food.qualityScore >= 80,
    entry.metrics.screenTimeHours <= goals.screenMaxHours,
    entry.social.metWithFriends,
  ].filter(Boolean).length;
  return Math.min(30, 10 + met * 5);
}
