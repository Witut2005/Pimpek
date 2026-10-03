import type { StatKey } from '../state/pet-rules';
import { Goals } from './settings.model';

export type SignalId = 'intake' | 'food' | 'sleep' | 'mood' | 'movement' | 'screen';

/** Something that keeps coming back in the recent check-ins. Found by rules, no AI involved. */
export interface ProfilePattern {
  signal: SignalId;
  need: StatKey;
  label: string;
  /** Bad days in a row, counting back from the newest entry that has this data. */
  streak: number;
  /** Bad days in the window… */
  badDays: number;
  /** …out of the days that had this data at all. */
  days: number;
}

/** What the backend's `POST /api/profile/summary` answers. */
export interface ProfileAnswer {
  /** Null only when the AI picked nothing valid and the rules found no pattern either. */
  focus: StatKey | null;
  headline: string;
  summary: string;
  observations: string[];
  tips: string[];
}

/** Pimpek's read of the last two weeks, kept in localStorage until the check-ins change. */
export interface ProfileSummary extends ProfileAnswer {
  generatedAt: string;
  /** Fingerprint of the check-ins it was written from: a different one means it's outdated. */
  basedOn: string;
  /** How many check-ins it read. */
  entries: number;
}

/** One check-in as the AI reads it: flat, notes included, nothing it doesn't need. */
export interface ProfileDay {
  date: string;
  mood: number;
  sleepHours: number;
  rested: boolean;
  sleepNote?: string;
  foodScore: number;
  /** The day's AI food rating, when there was one. */
  foodSummary?: string;
  /** "Obiad: makaron (250 g)". */
  meals?: string[];
  /** Only when every item had a number. */
  kcal?: number;
  foodNote?: string;
  runningKm: number;
  steps?: number;
  screenHours: number;
  metFriends: boolean;
  socialNote?: string;
  note?: string;
}

/** What the backend's `POST /api/profile/summary` takes. */
export interface ProfileRequest {
  today: string;
  goals: Goals;
  patterns: Omit<ProfilePattern, 'signal'>[];
  /** Oldest first. */
  days: ProfileDay[];
}
