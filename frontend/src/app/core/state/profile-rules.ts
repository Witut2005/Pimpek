import { DailyCheckIn } from '../models/check-in.model';
import { ProfileDay, ProfilePattern, ProfileRequest, SignalId } from '../models/profile.model';
import { Goals } from '../models/settings.model';
import { sumNutrients } from './food-entries';
import { fitnessScore, StatKey } from './pet-rules';
import { addDays } from '../../shared/date';

/** How far back the profile looks. */
export const PROFILE_DAYS = 14;
/** Fewer entries than this and nothing can "keep coming back" yet. */
export const PROFILE_MIN_ENTRIES = 3;
/** A whole day under this is too little for an adult, the same line the food rating uses. */
const LOW_INTAKE_KCAL = 1200;

interface Signal {
  id: SignalId;
  need: StatKey;
  label: string;
  /** Undefined when the day says nothing about it. */
  bad: (entry: DailyCheckIn, goals: Goals) => boolean | undefined;
}

/** The day's kcal, only when every item has a number: a partial sum would cry "too little". */
function knownKcal(entry: DailyCheckIn): number | undefined {
  const meals = entry.food.meals;
  if (!meals?.length || meals.some((m) => m.kcal === undefined)) return undefined;
  return sumNutrients(meals).kcal;
}

/** In priority order: on a tie, eating too little matters more than the rest. */
const SIGNALS: readonly Signal[] = [
  {
    id: 'intake',
    need: 'nutrition',
    label: 'Za mało jedzenia',
    bad: (e) => {
      const kcal = knownKcal(e);
      return kcal === undefined ? undefined : kcal < LOW_INTAKE_KCAL;
    },
  },
  // Nothing logged scores 50, so it never counts as a bad day.
  { id: 'food', need: 'nutrition', label: 'Słabsze jedzenie', bad: (e) => e.food.qualityScore < 50 },
  { id: 'sleep', need: 'energy', label: 'Za krótki sen', bad: (e, g) => e.sleep.durationHours < g.sleepHours - 0.5 },
  { id: 'mood', need: 'mood', label: 'Gorszy nastrój', bad: (e) => e.mood.score <= 4 },
  {
    id: 'movement',
    need: 'fitness',
    label: 'Mało ruchu',
    bad: (e, g) => fitnessScore(e.metrics.steps, e.metrics.runningDistanceKm, g) < 40,
  },
  { id: 'screen', need: 'screen', label: 'Dużo ekranu', bad: (e, g) => e.metrics.screenTimeHours > g.screenMaxHours },
];

/** The last two weeks of check-ins up to today, newest first. */
export function recentCheckIns(checkIns: readonly DailyCheckIn[], today: string): DailyCheckIn[] {
  const from = addDays(today, -(PROFILE_DAYS - 1));
  return checkIns
    .filter((c) => c.date >= from && c.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));
}

const weight = (p: ProfilePattern) => p.streak * 2 + p.badDays;

/**
 * What keeps coming back, strongest first. A run of bad days up to now beats the same number
 * of days scattered over two weeks. Days without an entry neither count nor break a run.
 */
export function findPatterns(recent: readonly DailyCheckIn[], goals: Goals): ProfilePattern[] {
  const found = SIGNALS.flatMap(({ id, need, label, bad }) => {
    const verdicts = recent.map((e) => bad(e, goals)).filter((v) => v !== undefined);
    const firstGood = verdicts.indexOf(false);
    const streak = firstGood === -1 ? verdicts.length : firstGood;
    const badDays = verdicts.filter(Boolean).length;
    const notable = streak >= 2 || (badDays >= 3 && badDays / verdicts.length >= 0.4);
    return notable ? [{ signal: id, need, label, streak, badDays, days: verdicts.length }] : [];
  });
  // Stable sort: equal weights keep the priority order of SIGNALS.
  return found.sort((a, b) => weight(b) - weight(a));
}

/** "3 dni z rzędu" or "4 z 9 dni", for the card. */
export function patternSpan(p: ProfilePattern): string {
  const scattered = `${p.badDays} z ${p.days} dni`;
  if (p.streak < 2) return scattered;
  return p.badDays > p.streak ? `${p.streak} dni z rzędu · ${scattered}` : `${p.streak} dni z rzędu`;
}

/** Changes whenever an entry in the window is added, edited or drops out of it. */
export function fingerprint(recent: readonly DailyCheckIn[]): string {
  const text = JSON.stringify(recent.map(({ companionReaction: _reaction, ...rest }) => rest));
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = (hash * 33) ^ text.charCodeAt(i);
  return `${recent.length}-${(hash >>> 0).toString(36)}`;
}

/** Cut to the backend's limits: a long note must not sink the whole summary. */
const clip = (text: string | undefined, max: number) => text?.trim().slice(0, max) || undefined;

function dayForAi(e: DailyCheckIn): ProfileDay {
  const meals = e.food.meals
    ?.slice(0, 40)
    .map((m) => `${m.mealName}: ${m.name}${m.amount ? ` (${m.amount})` : ''}`.slice(0, 160));
  const kcal = knownKcal(e);
  return {
    date: e.date,
    mood: Math.round(e.mood.score),
    sleepHours: e.sleep.durationHours,
    rested: e.sleep.feelingRested,
    sleepNote: clip(e.sleep.qualityNote, 300),
    foodScore: Math.round(e.food.qualityScore),
    // An estimate only restates the numbers; the AI's own rating says what was on the plate.
    foodSummary: e.food.rating?.source === 'ai' ? clip(e.food.rating.summary, 300) : undefined,
    meals: meals?.length ? meals : undefined,
    kcal: kcal === undefined ? undefined : Math.round(kcal),
    foodNote: clip(e.food.note, 300),
    runningKm: e.metrics.runningDistanceKm,
    steps: e.metrics.steps === undefined ? undefined : Math.round(e.metrics.steps),
    screenHours: e.metrics.screenTimeHours,
    metFriends: e.social.metWithFriends,
    socialNote: clip(e.social.context, 300),
    note: clip(e.note, 1000),
  };
}

export function profileRequest(
  recent: readonly DailyCheckIn[],
  patterns: readonly ProfilePattern[],
  goals: Goals,
  today: string,
): ProfileRequest {
  return {
    today,
    goals,
    patterns: patterns.map(({ signal: _signal, ...rest }) => rest),
    // Oldest first, so the model reads the days in the order they happened.
    days: [...recent].reverse().map(dayForAi),
  };
}
