import { AvatarState } from './check-in.model';
import { MoodLevel } from './journal.model';

/** Moments when Pimpek says something the user can put their own words into. */
export type SpeechSituation =
  | 'greeting'
  | 'mood4'
  | 'mood3'
  | 'mood2'
  | 'mood1'
  | 'petted'
  | 'tickled'
  | 'hugged'
  | 'thanks';

export interface SpeechSituationMeta {
  id: SpeechSituation;
  label: string;
  hint: string;
  /** Moments after an entry; their label follows the mood's name, which the user may change. */
  mood?: MoodLevel;
}

/** In the order the settings list them. */
export const SPEECH_SITUATIONS: readonly SpeechSituationMeta[] = [
  { id: 'greeting', label: 'Powitanie', hint: 'Gdy dziś nie ma jeszcze wpisu' },
  { id: 'mood4', label: 'Po wpisie', hint: 'Przez resztę dnia po wpisie', mood: 4 },
  { id: 'mood3', label: 'Po wpisie', hint: 'Przez resztę dnia po wpisie', mood: 3 },
  { id: 'mood2', label: 'Po wpisie', hint: 'Przez resztę dnia po wpisie', mood: 2 },
  { id: 'mood1', label: 'Po wpisie', hint: 'Przez resztę dnia po wpisie', mood: 1 },
  { id: 'petted', label: 'Głaskanie', hint: 'Gdy go głaszczesz' },
  { id: 'tickled', label: 'Łaskotki', hint: 'Gdy szybko łaskoczesz go palcem' },
  { id: 'hugged', label: 'Przytulanie', hint: 'Gdy przytrzymasz na nim palec' },
  { id: 'thanks', label: 'Po przytulasie', hint: 'Gdy puścisz go po przytuleniu' },
];

export const HUGS: Record<AvatarState, string> = {
  happy: 'Przytulaaas! 🤗',
  neutral: 'Ojej, przytulas 🤗',
  sleepy: 'Mmm… cieplutko… 😴',
  sad: 'Właśnie tego potrzebowałem… 🥺',
  sick: 'Przytul mnie mocno… 🤒',
};

export const THANKS: Record<AvatarState, string> = {
  happy: 'Dzięki, potrzebowałem tego 🫶',
  neutral: 'Dzięki, od razu lepiej 🫶',
  sleepy: 'Mmm… teraz mogę spać 😴',
  sad: 'Już mi trochę lepiej 💙',
  sick: 'Dziękuję… już mi cieplej 💚',
};

/** What he says out of the box. Hugs and thanks depend on his mood, so their callers narrow these down. */
export const DEFAULT_LINES: Record<SpeechSituation, readonly string[]> = {
  greeting: ['Hej, miło Cię widzieć 💙 Jeśli masz ochotę, kliknij mnie i opowiedz, jak się czujesz.'],
  mood4: ['Czuję się świetnie razem z Tobą! 🥳 Zapamiętam ten dzień.'],
  mood3: ['Dobrze, że jest dobrze 🙂 Dzięki za wpis!'],
  mood2: ['Średnio też się liczy. Jestem obok 💭'],
  mood1: ['Złe dni też mijają. Jestem z Tobą 💙 Może napiszesz do kogoś bliskiego?'],
  petted: ['Mrrr… jak miło 💙', 'Hihi, łaskocze! 😊', 'Jeszcze, jeszcze! 🥰', 'Uwielbiam to 💛', 'Mrrr… mrrr… 💗'],
  tickled: ['Hihihi! Przestań! 😆', 'Hahaha, łaskocze! 🤣', 'Nie tam! Hihi! 😂'],
  hugged: Object.values(HUGS),
  thanks: Object.values(THANKS),
};

export const LINE_MAX_LENGTH = 120;

/** The user's own lines for each moment. */
export interface Speech {
  lines: Partial<Record<SpeechSituation, string[]>>;
  /** Off: once a moment has lines of the user's own, only those are said. */
  mixDefaults: boolean;
}

export const DEFAULT_SPEECH: Speech = { lines: {}, mixDefaults: false };

export function moodSituation(mood: MoodLevel): SpeechSituation {
  return `mood${mood}` as const;
}

/** Everything Pimpek may say in this moment; `defaults` overrides the built-in lines (e.g. one per mood). */
export function linesFor(
  speech: Speech,
  situation: SpeechSituation,
  defaults: readonly string[] = DEFAULT_LINES[situation],
): readonly string[] {
  const own = speech.lines[situation] ?? [];
  if (!own.length) return defaults;
  return speech.mixDefaults ? [...defaults, ...own] : own;
}

export const pickRandom = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
