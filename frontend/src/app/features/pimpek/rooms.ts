import { AvatarState } from '../../core/models/check-in.model';
import { IconName } from '../../shared/icon/icon';

/** Where Pimpek is: his room (cuddles), the bathroom (a bath) or the playroom (ball and cups). */
export type Room = 'home' | 'bath' | 'play';

/** The games in the playroom. */
export type Game = 'ball' | 'cups';

/** Left to right: his room sits in the middle, the arrows at the sides lead to the others. */
export const ROOMS: readonly { id: Room; label: string; icon: IconName }[] = [
  { id: 'bath', label: 'Łazienka', icon: 'bath' },
  { id: 'home', label: 'Pokój', icon: 'home' },
  { id: 'play', label: 'Zabawy', icon: 'ball' },
];

export const GAMES: readonly { id: Game; label: string; icon: IconName }[] = [
  { id: 'ball', label: 'Piłka', icon: 'ball' },
  { id: 'cups', label: 'Kubki', icon: 'cup' },
];

/** What he says in the playroom until the game gets going. */
export const GAME_HINTS: Record<Game, Record<AvatarState, string>> = {
  ball: {
    happy: 'Rzuć mi piłkę! 🎾',
    neutral: 'Pobawimy się? Rzuć piłkę 🎾',
    sad: 'Nie wiem, czy mam siłę… ale rzuć 🎾',
    sleepy: 'Mhm… jedna piłka? 😴',
    sick: 'Dziś nie dam rady biegać… może kubki? 🤒',
  },
  cups: {
    happy: 'Stuknij kubek: schowam piłkę i pomieszam! 🥤',
    neutral: 'Zgadniesz, gdzie schowam piłkę? Stuknij kubek 🥤',
    sad: 'Pomieszam kubki… stuknij któryś 🥤',
    sleepy: 'Pomieszam… powolutku… stuknij kubek 😴',
    sick: 'Pomieszać mogę… powoli. Stuknij kubek 🤒',
  },
};
