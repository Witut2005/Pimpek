import { AvatarState } from '../models/check-in.model';
import { MoodLevel } from '../models/journal.model';

/** Pimpek mirrors the mood you just wrote down. */
export function avatarStateFor(mood: MoodLevel): AvatarState {
  if (mood >= 4) return 'happy';
  if (mood === 3) return 'neutral';
  return 'sad';
}

/** Days with at least one entry. It only ever grows, so skipping a day costs nothing. */
export function daysTogether(dates: ReadonlySet<string>, today: string): number {
  let count = 0;
  for (const date of dates) if (date <= today) count++;
  return count;
}
