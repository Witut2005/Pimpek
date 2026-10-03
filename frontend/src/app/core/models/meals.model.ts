/** Grams, except `kcal`. Always for the logged portion. */
export interface Nutrients {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  sugars: number;
}

export interface MealItem extends Nutrients {
  /** The diary's own id for the item, stable across reloads. */
  id: string | null;
  name: string;
  brand: string | null;
  /** "1,5 porcja" or "250 g", as the diary shows it. */
  amount: string | null;
}

export interface Meal {
  key: string;
  name: string;
  /** `HH:MM`, when the diary has a time for the meal. */
  time: string | null;
  kcal: number;
  items: MealItem[];
}

/** One day from a food diary (Fitatu), as normalised by the backend. Only meals with items. */
export interface MealDay {
  /** Local calendar day, `YYYY-MM-DD`. */
  date: string;
  meals: Meal[];
  /** Everything logged that day, like the diary's own day total. */
  totals: Nutrients;
}

/** The meals to pick from when typing food in. Same keys as Fitatu, so both share one list. */
export const MEAL_SLOTS: readonly { key: string; name: string }[] = [
  { key: 'breakfast', name: 'Śniadanie' },
  { key: 'second_breakfast', name: 'II śniadanie' },
  { key: 'dinner', name: 'Obiad' },
  { key: 'snack', name: 'Przekąska' },
  { key: 'supper', name: 'Kolacja' },
];

/**
 * One thing eaten, as confirmed in the check-in: taken from the diary or typed in.
 * Nutrients are known for diary items; for typed-in food the AI estimates them.
 */
export interface FoodEntry extends Partial<Nutrients> {
  /** Local id, for editing in the list. */
  id: string;
  /** Meal key (`breakfast`, `dinner`, …) and its display name. */
  meal: string;
  mealName: string;
  /** `HH:MM`, from the diary. */
  mealTime?: string;
  name: string;
  amount?: string;
  /** Set for items from the diary: a reload refreshes them, unless `edited`. */
  fitatuId?: string;
  /** Changed by hand. A reload from the diary leaves it as it is. */
  edited?: boolean;
}

/** How healthy the day's food was: the AI's verdict, or a rough estimate without it. */
export interface FoodRating {
  /** 0–100, becomes the check-in's food score. */
  score: number;
  label: string;
  summary: string;
  positives: string[];
  improvements: string[];
  /** The AI thinks not everything eaten was logged. */
  incomplete: boolean;
  source: 'ai' | 'estimate';
}

/** What the backend's `POST /api/food/rating` takes. */
export interface RatingRequest {
  date: string;
  meals: {
    name: string;
    time?: string;
    items: (Partial<Nutrients> & { name: string; amount?: string; source: 'fitatu' | 'manual' })[];
  }[];
}
