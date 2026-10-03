import { FoodEntry, FoodRating, MEAL_SLOTS, MealDay, Nutrients, RatingRequest } from '../models/meals.model';
import { foodLabel, foodScoreFromMeals } from './pet-rules';

const NUTRIENT_KEYS = ['kcal', 'protein', 'fat', 'carbs', 'fiber', 'sugars'] as const;
/** Breakfast first, supper last; meals the picker doesn't know go after them. */
const MEAL_ORDER = ['breakfast', 'second_breakfast', 'lunch', 'dinner', 'snack', 'supper'];

export interface MealGroup {
  meal: string;
  name: string;
  time?: string;
  /** Of the entries whose kcal is known. */
  kcal: number;
  entries: FoodEntry[];
}

const newId = () => crypto.randomUUID();

const mealRank = (meal: string) => {
  const i = MEAL_ORDER.indexOf(meal);
  return i === -1 ? MEAL_ORDER.length : i;
};

export const sortByMeal = (entries: FoodEntry[]) =>
  [...entries].sort((a, b) => mealRank(a.meal) - mealRank(b.meal));

export function mealName(meal: string): string {
  return MEAL_SLOTS.find((s) => s.key === meal)?.name ?? meal;
}

/** The meal someone is most likely adding at this hour. */
export function mealAt(hour: number): string {
  if (hour < 10) return 'breakfast';
  if (hour < 12) return 'second_breakfast';
  if (hour < 16) return 'dinner';
  if (hour < 18) return 'snack';
  return 'supper';
}

export function entriesFromDiary(day: MealDay): FoodEntry[] {
  return day.meals.flatMap((meal) =>
    meal.items.map((item) => ({
      id: newId(),
      meal: meal.key,
      mealName: meal.name,
      mealTime: meal.time ?? undefined,
      name: item.name,
      amount: item.amount ?? undefined,
      // Without Fitatu's id, the meal and name are the next best thing to recognise it by.
      fitatuId: item.id ?? `${meal.key}/${item.name}`,
      ...Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, item[k]])),
    })),
  );
}

/**
 * A reload from the diary. Its items replace the untouched ones taken from it before, and
 * one removed here comes back while it's still in the diary. Typed-in and hand-edited
 * entries stay as they are, without a second copy from the diary.
 */
export function mergeDiary(current: FoodEntry[], day: MealDay): FoodEntry[] {
  const kept = current.filter((e) => !e.fitatuId || e.edited);
  const keptIds = new Set(kept.map((e) => e.fitatuId));
  const fresh = entriesFromDiary(day).filter((e) => !keptIds.has(e.fitatuId));
  return sortByMeal([...fresh, ...kept]);
}

export function groupByMeal(entries: FoodEntry[]): MealGroup[] {
  const groups = new Map<string, MealGroup>();
  for (const entry of sortByMeal(entries)) {
    const group = groups.get(entry.meal) ?? {
      meal: entry.meal,
      name: entry.mealName,
      time: entry.mealTime,
      kcal: 0,
      entries: [],
    };
    group.kcal += entry.kcal ?? 0;
    group.entries.push(entry);
    groups.set(entry.meal, group);
  }
  return [...groups.values()];
}

/** Sums what is known; typed-in food without numbers adds nothing here. */
export function sumNutrients(entries: FoodEntry[]): Nutrients {
  const totals = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as unknown as Nutrients;
  for (const entry of entries) for (const k of NUTRIENT_KEYS) totals[k] += entry[k] ?? 0;
  return totals;
}

/** Cut to the backend's limits: a long product name from the diary must not sink the rating. */
export function ratingRequest(date: string, entries: FoodEntry[]): RatingRequest {
  return {
    date,
    meals: groupByMeal(entries).map((group) => ({
      name: group.name.slice(0, 40),
      time: group.time,
      items: group.entries.map((e) => ({
        name: e.name.slice(0, 120),
        amount: e.amount?.slice(0, 60),
        source: e.fitatuId && !e.edited ? 'fitatu' : 'manual',
        ...Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, e[k]])),
      })),
    })),
  };
}

/** When the AI isn't available: a guess from the numbers alone, and it says so. */
export function estimateFoodRating(entries: FoodEntry[]): FoodRating {
  const score = foodScoreFromMeals(sumNutrients(entries), groupByMeal(entries).length);
  return {
    score,
    label: foodLabel(score),
    summary: 'Ocena przybliżona z kalorii i makroskładników, bo AI jest teraz niedostępne. Spróbuj ponownie za chwilę.',
    positives: [],
    improvements: [],
    source: 'estimate',
  };
}
