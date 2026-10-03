import { AvatarState, CheckInInput, DailyCheckIn } from '../models/check-in.model';
import { avatarStateFor, GOALS, statsFor } from '../state/pet-rules';

const INTROS: Record<AvatarState, string> = {
  happy: 'Czuję się świetnie! 🥳',
  neutral: 'Dzięki za wpis!',
  sleepy: 'Ziew... 😴',
  sad: 'Trochę mi smutno...',
  sick: 'Kiepsko się czuję 🤒',
};

/** Rule-based stand-in for what the backend (or an LLM) would answer. */
export function buildCompanionReaction(input: CheckInInput): DailyCheckIn['companionReaction'] {
  const avatarState = avatarStateFor(statsFor(input));
  const { sleep, food, metrics, social, mood } = input;

  const praise: string[] = [];
  if (metrics.runningDistanceKm >= GOALS.runningKm) {
    praise.push(`${metrics.runningDistanceKm} km przebiegnięte – brawo! 🏃`);
  }
  if (social.metWithFriends) praise.push('Spotkanie z ludźmi to super sprawa 🫶');
  if (food.qualityScore >= 80) praise.push('Świetnie zjedzone 🥗');
  if (sleep.durationHours >= GOALS.sleepHours && sleep.feelingRested) {
    praise.push('Dobrze przespana noc to podstawa 💤');
  }
  if (metrics.screenTimeHours <= 2) praise.push('Mało ekranu – oczy dziękują 👀');

  const tips: string[] = [];
  if (sleep.durationHours < GOALS.sleepHours) tips.push('Dziś połóż się wcześniej 🛌');
  if (mood.score <= 4) tips.push('Gorszy dzień się zdarza. Jestem z Tobą 💙');
  if (metrics.runningDistanceKm === 0) tips.push('Jutro choć krótki spacer? 👟');
  if (food.qualityScore < 50) tips.push('Postaw jutro na coś zielonego 🥦');
  if (metrics.screenTimeHours > 5) tips.push('Odłóż telefon godzinę przed snem 📵');

  const message = [INTROS[avatarState], ...praise.slice(0, 2), ...tips.slice(0, 1)].join(' ');
  return { message, avatarState };
}
