/** 1 = zły … 4 = hapi hapi. */
export type MoodLevel = 1 | 2 | 3 | 4;

/** The mood of one day. One entry per day, no time of day: the date is its key. */
export interface MoodEntry {
  /** Local calendar day, `YYYY-MM-DD`. */
  date: string;
  mood: MoodLevel;
  note?: string;
}

export interface MoodMeta {
  level: MoodLevel;
  label: string;
  emoji: string;
}

/**
 * Worst first, left to right as the picker shows them. Colours are `--mood-<level>` in styles.scss.
 * The labels are only defaults: the user can rename every mood in the settings.
 */
export const MOODS: readonly MoodMeta[] = [
  { level: 1, label: 'Zły', emoji: '😞' },
  { level: 2, label: 'Średni', emoji: '😐' },
  { level: 3, label: 'Ok', emoji: '🙂' },
  { level: 4, label: 'Hapi hapi', emoji: '😄' },
];

export const MOOD_LABEL_MAX_LENGTH = 20;

/** The user's own names for the moods; a missing or blank one keeps the default. */
export type MoodLabels = Partial<Record<MoodLevel, string>>;

export function withLabels(labels: MoodLabels): MoodMeta[] {
  return MOODS.map((m) => ({ ...m, label: labels[m.level]?.trim() || m.label }));
}

export function moodMeta(level: MoodLevel, moods: readonly MoodMeta[] = MOODS): MoodMeta {
  return moods.find((m) => m.level === level) ?? moods[0];
}

/** Journals from before the four-level scale used 1–5: zły takes both of the two lowest. */
export function fromFiveLevels(mood: number): MoodLevel {
  return Math.min(4, Math.max(1, Math.round(mood) - 1)) as MoodLevel;
}

export const NOTE_MAX_LENGTH = 280;
