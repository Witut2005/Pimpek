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
    /** 0–100 */
    qualityScore: number;
    note?: string;
  };
  metrics: {
    runningDistanceKm: number;
    screenTimeHours: number;
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
