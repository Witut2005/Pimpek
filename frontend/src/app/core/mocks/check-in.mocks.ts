import { CheckInInput, DailyCheckIn } from '../models/check-in.model';
import { buildCompanionReaction } from '../services/companion-reaction';
import { addDays } from '../../shared/date';

type SeedEntry = Omit<CheckInInput, 'date'> & { daysAgo: number };

/**
 * Past week of data. Deliberately nothing for today, so Pimpek asks for a check-in on start.
 * A 4-day streak means today's entry unlocks the crown 👑.
 */
const SEED: SeedEntry[] = [
  {
    daysAgo: 1,
    mood: { score: 8, label: 'całkiem spoko' },
    sleep: { durationHours: 6.5, feelingRested: false, qualityNote: 'późno poszedłem spać' },
    food: { qualityScore: 75, note: 'dobry obiad, ale wjechała też czekolada' },
    metrics: { runningDistanceKm: 3.5, screenTimeHours: 4.0 },
    social: { metWithFriends: true, context: 'szybkie piwko bezalkoholowe ze znajomymi' },
    note: 'intensywny dzień, ale przyjemny',
  },
  {
    daysAgo: 2,
    mood: { score: 9, label: 'super' },
    sleep: { durationHours: 8, feelingRested: true },
    food: { qualityScore: 85, note: 'sałatka z kurczakiem i owoce' },
    metrics: { runningDistanceKm: 5, screenTimeHours: 2.5 },
    social: { metWithFriends: false },
    note: 'nowa życiówka na 5 km!',
  },
  {
    daysAgo: 3,
    mood: { score: 6, label: 'tak sobie' },
    sleep: { durationHours: 7, feelingRested: true },
    food: { qualityScore: 60, note: 'pizza na mieście' },
    metrics: { runningDistanceKm: 0, screenTimeHours: 5.5 },
    social: { metWithFriends: true, context: 'kino z ekipą' },
  },
  {
    daysAgo: 4,
    mood: { score: 4, label: 'słabo' },
    sleep: { durationHours: 5, feelingRested: false, qualityNote: 'deadline w pracy' },
    food: { qualityScore: 40, note: 'fast food w biegu' },
    metrics: { runningDistanceKm: 0, screenTimeHours: 7 },
    social: { metWithFriends: false },
    note: 'ciężki dzień',
  },
  {
    daysAgo: 6,
    mood: { score: 7, label: 'całkiem spoko' },
    sleep: { durationHours: 8, feelingRested: true },
    food: { qualityScore: 82, note: 'domowe curry' },
    metrics: { runningDistanceKm: 4, screenTimeHours: 1.5 },
    social: { metWithFriends: true, context: 'planszówki' },
  },
  {
    daysAgo: 7,
    mood: { score: 7, label: 'całkiem spoko' },
    sleep: { durationHours: 7, feelingRested: true },
    food: { qualityScore: 70 },
    metrics: { runningDistanceKm: 2.5, screenTimeHours: 3 },
    social: { metWithFriends: false },
  },
  {
    daysAgo: 9,
    mood: { score: 5, label: 'tak sobie' },
    sleep: { durationHours: 6, feelingRested: false },
    food: { qualityScore: 55 },
    metrics: { runningDistanceKm: 0, screenTimeHours: 6 },
    social: { metWithFriends: false },
  },
];

export function buildSeedCheckIns(today: string): DailyCheckIn[] {
  return SEED.map(({ daysAgo, ...entry }) => {
    const date = addDays(today, -daysAgo);
    const input: CheckInInput = { ...entry, date };
    return {
      ...input,
      id: `entry-${date}`,
      createdAt: new Date(`${date}T21:00:00`).toISOString(),
      companionReaction: buildCompanionReaction(input),
    };
  });
}
