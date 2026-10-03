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
