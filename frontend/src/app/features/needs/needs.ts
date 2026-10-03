import { Goals } from '../../core/models/settings.model';
import { DayView } from '../../core/state/pet.store';
import { foodLabel, moodLabel, StatKey } from '../../core/state/pet-rules';
import { IconName } from '../../shared/icon/icon';
import { formatHours, formatSteps } from '../../shared/format';

export type Level = 'good' | 'ok' | 'low';

export const levelOf = (value: number): Level => (value >= 70 ? 'good' : value >= 40 ? 'ok' : 'low');

export interface NeedMeta {
  label: string;
  icon: IconName;
  words: Record<Level, string>;
  /** The raw daily value behind this need, for charts and the detail sheet. */
  value: (day: DayView) => number | undefined;
  format: (value: number) => string;
  /** Chart ceiling and the goal line; `goalMode: 'max'` means less is better. */
  max: (goals: Goals) => number;
  goal?: (goals: Goals) => number;
  goalMode: 'min' | 'max';
  goalLabel?: (goals: Goals) => string;
  tip: string;
}

export const NEEDS: Record<StatKey, NeedMeta> = {
  energy: {
    label: 'Sen',
    icon: 'moon',
    words: { good: 'wyspany', ok: 'zmęczony', low: 'śpiący' },
    value: (d) => d.sleepHours,
    format: formatHours,
    max: () => 10,
    goal: (g) => g.sleepHours,
    goalMode: 'min',
    goalLabel: (g) => `cel: ${formatHours(g.sleepHours)}`,
    tip: 'Stała pora zasypiania pomaga bardziej niż odsypianie w weekend.',
  },
  nutrition: {
    label: 'Jedzenie',
    icon: 'apple',
    words: { good: 'najedzony', ok: 'podjada', low: 'głodny' },
    value: (d) => d.food,
    format: foodLabel,
    max: () => 100,
    goal: () => 80,
    goalMode: 'min',
    tip: 'Pół talerza warzyw to najprostszy trik na lepszą ocenę dnia.',
  },
  fitness: {
    label: 'Ruch',
    icon: 'steps',
    words: { good: 'w formie', ok: 'rozruszany', low: 'zastany' },
    value: (d) => d.steps ?? (d.runningKm !== undefined ? d.runningKm * 1300 : undefined),
    format: (v) => `${formatSteps(v)} kroków`,
    max: (g) => g.steps * 1.5,
    goal: (g) => g.steps,
    goalMode: 'min',
    goalLabel: (g) => `cel: ${formatSteps(g.steps)}`,
    tip: 'Kwadrans spaceru po obiedzie to łatwe 2 tysiące kroków.',
  },
  mood: {
    label: 'Nastrój',
    icon: 'smile',
    words: { good: 'radosny', ok: 'spokojny', low: 'markotny' },
    value: (d) => d.mood,
    format: moodLabel,
    max: () => 10,
    goalMode: 'min',
    tip: 'Krótka rozmowa z kimś bliskim potrafi odwrócić cały dzień.',
  },
  screen: {
    label: 'Ekran',
    icon: 'phone',
    words: { good: 'offline', ok: 'zerka w ekran', low: 'zmęczone oczy' },
    value: (d) => d.screen,
    format: formatHours,
    max: () => 8,
    goal: (g) => g.screenMaxHours,
    goalMode: 'max',
    goalLabel: (g) => `max ${formatHours(g.screenMaxHours)}`,
    tip: 'Ładowarka poza sypialnią to najskuteczniejszy detoks.',
  },
};
