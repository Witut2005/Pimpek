import { MoodLevel } from '../models/journal.model';

const REACTIONS: Record<MoodLevel, string> = {
  5: 'Czuję się świetnie razem z Tobą! 🥳 Zapamiętam ten dzień.',
  4: 'Dobrze, że jest dobrze 🙂 Dzięki za wpis!',
  3: 'Tak sobie też się liczy. Jestem obok 💭',
  2: 'Trochę mi smutno, że jest źle… Przytulisz mnie? 💙',
  1: 'Okropne dni też mijają. Jestem z Tobą 💙 Może napiszesz do kogoś bliskiego?',
};

/** What Pimpek says right after an entry, and for the rest of that day. */
export function reactionTo(mood: MoodLevel): string {
  return REACTIONS[mood];
}
