import { AvatarState, CheckInInput, DailyCheckIn } from '../models/check-in.model';
import { WearableDay } from '../models/metrics.model';
import { Goals } from '../models/settings.model';
import { avatarStateFor, GOALS, statsFor } from '../state/pet-rules';
import { formatHours, formatKm, formatSteps } from '../../shared/format';

const INTROS: Record<AvatarState, string> = {
  happy: 'Czuję się świetnie! 🥳',
  neutral: 'Dzięki za wpis!',
  sleepy: 'Ziew... 😴',
  sad: 'Trochę mi smutno...',
  sick: 'Kiepsko się czuję 🤒',
};

/** Rule-based stand-in for what the backend (or an LLM) would answer. */
export function buildCompanionReaction(
  input: CheckInInput,
  goals: Goals = GOALS,
): DailyCheckIn['companionReaction'] {
  const avatarState = avatarStateFor(statsFor(input, goals));
  const { sleep, food, metrics, social, mood } = input;

  const praise: string[] = [];
  if (metrics.steps !== undefined && metrics.steps >= goals.steps) {
    praise.push(`${formatSteps(metrics.steps)} kroków – brawo! 🥾`);
  } else if (metrics.runningDistanceKm >= goals.runningKm) {
    praise.push(`${metrics.runningDistanceKm} km przebiegnięte – brawo! 🏃`);
  }
  if (social.metWithFriends) praise.push('Spotkanie z ludźmi to super sprawa 🫶');
  if (food.qualityScore >= 80) praise.push('Świetnie zjedzone 🥗');
  if (sleep.durationHours >= goals.sleepHours && sleep.feelingRested) {
    praise.push('Dobrze przespana noc to podstawa 💤');
  }
  if (metrics.screenTimeHours <= 2) praise.push('Mało ekranu – oczy dziękują 👀');

  const tips: string[] = [];
  if (sleep.durationHours < goals.sleepHours) tips.push('Dziś połóż się wcześniej 🛌');
  if (mood.score <= 4) tips.push('Gorszy dzień się zdarza. Jestem z Tobą 💙');
  if (metrics.runningDistanceKm === 0 && (metrics.steps ?? 0) < goals.steps / 2) {
    tips.push('Jutro choć krótki spacer? 👟');
  }
  if (food.qualityScore < 50) tips.push('Postaw jutro na coś zielonego 🥦');
  if (metrics.screenTimeHours > 5) tips.push('Odłóż telefon godzinę przed snem 📵');

  const message = [INTROS[avatarState], ...praise.slice(0, 2), ...tips.slice(0, 1)].join(' ');
  return { message, avatarState };
}

/** What Pimpek says right after fresh wearable data arrives, before today's check-in. */
export function wearableGreeting(day: WearableDay, sourceName: string, goals: Goals, longAway: boolean): string {
  const parts: string[] = [];
  const sleep = day.sleepHours;
  if (sleep === undefined) {
    parts.push(`${sourceName} nie widział dziś Twojego snu. Spałeś/aś bez zegarka?`);
  } else if (sleep < goals.sleepHours - 1) {
    parts.push(`${sourceName} pokazuje tylko ${formatHours(sleep)} snu… ziew 😴`);
  } else if (sleep >= goals.sleepHours) {
    parts.push(`${formatHours(sleep)} snu, czuję się wyspany! 💤`);
  } else {
    parts.push(`${formatHours(sleep)} snu, prawie jak trzeba.`);
  }
  if (day.runningKm) parts.push(`Widzę ${formatKm(day.runningKm)} biegu, brawo! 🏃`);
  else if (day.steps >= goals.steps) parts.push(`I już ${formatSteps(day.steps)} kroków!`);
  parts.push(longAway ? 'Długo Cię nie było, tęskniłem 💭' : 'Opowiesz, jak minął dzień?');
  return parts.join(' ');
}
