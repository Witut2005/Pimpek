/**
 * Training history as the backend will hand it over once the real Strava OAuth exists
 * (GET /api/v3/athlete/activities, scope `activity:read_all`), already trimmed to what Pimpek uses.
 */
export type SportType = 'Run' | 'Ride' | 'Walk' | 'Hike' | 'Swim' | 'WeightTraining' | 'Yoga';

export interface StravaActivity {
  id: number;
  /** Local day the activity started, `YYYY-MM-DD`. */
  date: string;
  /** Local start time, `HH:MM`. */
  start: string;
  name: string;
  sport: SportType;
  /** 0 for workouts without distance (gym, yoga). */
  distanceKm: number;
  movingMinutes: number;
  elevationM: number;
  avgHr?: number;
  kudos: number;
}

export interface StravaAthlete {
  firstName: string;
  city: string;
  /** Year the account was created. */
  since: number;
}

export interface StravaImport {
  athlete: StravaAthlete;
  /** Newest first. */
  activities: StravaActivity[];
  /** How far back the import reached, in months, and when it ran. */
  months: number;
  importedAt: string;
}

export const SPORTS: Record<SportType, { label: string; emoji: string; distance: boolean }> = {
  Run: { label: 'Bieganie', emoji: '🏃', distance: true },
  Ride: { label: 'Rower', emoji: '🚴', distance: true },
  Walk: { label: 'Spacer', emoji: '🚶', distance: true },
  Hike: { label: 'Wędrówka', emoji: '🥾', distance: true },
  Swim: { label: 'Pływanie', emoji: '🏊', distance: true },
  WeightTraining: { label: 'Siłownia', emoji: '🏋️', distance: false },
  Yoga: { label: 'Joga', emoji: '🧘', distance: false },
};

/** What the user lets Pimpek read — mirrors the Strava OAuth scopes we would request. */
export const STRAVA_SCOPES: readonly { scope: string; label: string; required: boolean }[] = [
  { scope: 'read', label: 'Imię i miasto z profilu', required: true },
  { scope: 'activity:read_all', label: 'Treningi: rodzaj, dystans, czas, przewyższenie', required: true },
  { scope: 'activity:read_all:hr', label: 'Średnie tętno z treningów', required: false },
];

/** Never read, said out loud in the consent step. */
export const STRAVA_NEVER_READ = ['trasy i mapy GPS', 'zdjęcia', 'obserwujących i komentarze', 'wiadomości'];
