import { FoodEntry, FoodRating } from './meals.model';

export type AvatarState = 'happy' | 'neutral' | 'sleepy' | 'sad' | 'sick';

export interface DailyCheckIn {
  id: string;
  /** Local calendar day, `YYYY-MM-DD`. */
  date: string;
  createdAt: string;
  mood: {
    /** 1–10 */
    score: number;
    label: string;
  };
  sleep: {
    durationHours: number;
    feelingRested: boolean;
    qualityNote?: string;
  };
  food: {
    /** 0–100: the rating's score, or neutral when nothing was logged. */
    qualityScore: number;
    /** What was eaten: from the food diary and/or typed in. */
    meals?: FoodEntry[];
    rating?: FoodRating;
    /** Free text from before the meal list; only older entries and the demo data have it. */
    note?: string;
  };
  metrics: {
    runningDistanceKm: number;
    screenTimeHours: number;
    /** Filled in from a connected wearable, absent for manual-only days. */
    steps?: number;
  };
  social: {
    metWithFriends: boolean;
    context?: string;
  };
  note?: string;
  companionReaction: {
    message: string;
    avatarState: AvatarState;
  };
}

/** What the user submits — the backend fills in id, timestamps and the companion reaction. */
export type CheckInInput = Omit<DailyCheckIn, 'id' | 'createdAt' | 'companionReaction'>;
