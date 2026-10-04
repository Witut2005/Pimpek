/** 1 = okropnie … 5 = świetnie. */
export type MoodLevel = 1 | 2 | 3 | 4 | 5;

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

/** Best first, the order the picker shows them in. Colours are `--mood-<level>` in styles.scss. */
export const MOODS: readonly MoodMeta[] = [
  { level: 5, label: 'świetnie', emoji: '😄' },
  { level: 4, label: 'dobrze', emoji: '🙂' },
  { level: 3, label: 'tak sobie', emoji: '😐' },
  { level: 2, label: 'źle', emoji: '😟' },
  { level: 1, label: 'okropnie', emoji: '😫' },
];

export function moodMeta(level: MoodLevel): MoodMeta {
  return MOODS.find((m) => m.level === level) ?? MOODS[2];
}

export const NOTE_MAX_LENGTH = 280;
