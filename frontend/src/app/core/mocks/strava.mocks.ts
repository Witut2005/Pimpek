import { SportType, StravaActivity, StravaAthlete } from '../models/strava.model';
import { addDays } from '../../shared/date';

/** FNV-1a hash → 0..1, so the same day always gets the same fake workout. */
function noise(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const between = (n: number, min: number, max: number) => min + n * (max - min);

function weekday(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function clock(hour: number, minutes: number): string {
  return `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor(minutes)).padStart(2, '0')}`;
}

function runName(hour: number, long: boolean): string {
  if (long) return 'Długi bieg niedzielny';
  if (hour < 10) return 'Poranny bieg';
  if (hour < 17) return 'Popołudniowy bieg';
  return 'Wieczorny bieg';
}

/** Placeholder profile; the name comes from the e-mail typed into the mock login. */
export function mockAthlete(email: string): StravaAthlete {
  const local = email.split('@')[0]?.replace(/[^\p{L}]/gu, '') ?? '';
  const firstName = local ? local[0].toUpperCase() + local.slice(1).toLowerCase() : 'Sportowiec';
  return { firstName, city: 'Kraków', since: 2021 };
}

/**
 * A believable year of training: short runs on Tuesdays and Thursdays, a long run on Sundays
 * that grows over the months, rides in summer, the gym in winter, a swim or yoga now and then,
 * and a Tatra hike or two. Pace improves slowly, so the history tells a story of progress.
 * Newest first, like the summary view needs it.
 */
export function buildStravaHistory(today: string, months: number): StravaActivity[] {
  const span = Math.round(months * 30.4);
  const activities: StravaActivity[] = [];

  const add = (
    date: string,
    sport: SportType,
    name: string,
    start: string,
    distanceKm: number,
    movingMinutes: number,
    elevationM: number,
    avgHr: number | undefined,
    salt: string,
  ) => {
    activities.push({
      id: Math.floor(noise(`${date}:${salt}:id`) * 9e8) + 1e10,
      date,
      start,
      name,
      sport,
      distanceKm: round1(distanceKm),
      movingMinutes: Math.round(movingMinutes),
      elevationM: Math.round(elevationM),
      avgHr: avgHr && Math.round(avgHr),
      kudos: Math.round(noise(`${date}:${salt}:kudos`) * (sport === 'Hike' ? 30 : 14)),
    });
  };

  for (let ago = span; ago >= 1; ago--) {
    const date = addDays(today, -ago);
    const n = (salt: string) => noise(`${date}:${salt}`);
    const dow = weekday(date);
    const month = Number(date.slice(5, 7));
    const summer = month >= 4 && month <= 9;
    // 0 a year ago → 1 now: longer runs, faster pace.
    const fitness = 1 - ago / span;
    // Every sixth week is an easy one: fewer workouts, like a real plan.
    const easyWeek = Math.floor(ago / 7) % 6 === 0;
    const keep = (chance: number) => (easyWeek ? chance * 0.4 : chance);

    if ((dow === 2 || dow === 4) && n('run') < keep(0.78)) {
      const km = between(n('km'), 4, 8) + fitness * 1.5;
      const pace = 6.15 - fitness * 0.6 + (n('pace') - 0.5) * 0.3;
      const hour = n('hour') < 0.45 ? between(n('h'), 6, 8) : between(n('h'), 17, 19.5);
      add(date, 'Run', runName(hour, false), clock(hour, n('m') * 60), km, km * pace, between(n('el'), 20, 90), between(n('hr'), 146, 162), 'run');
    }
    if (dow === 0 && n('long') < keep(0.8)) {
      const km = between(n('km'), 9, 12) + fitness * 7;
      const pace = 6.4 - fitness * 0.55 + (n('pace') - 0.5) * 0.25;
      add(date, 'Run', runName(9, true), clock(between(n('h'), 8, 10), n('m') * 60), km, km * pace, between(n('el'), 60, 220), between(n('hr'), 140, 152), 'long');
    }
    if (dow === 6 && summer && n('ride') < keep(0.7)) {
      const km = between(n('km'), 28, 75);
      const name = n('tyniec') < 0.4 ? 'Rowerem do Tyńca' : 'Sobotnia przejażdżka';
      add(date, 'Ride', name, clock(between(n('h'), 9, 11), n('m') * 60), km, (km / between(n('spd'), 23, 28)) * 60, between(n('el'), 150, 700), between(n('hr'), 124, 142), 'ride');
    } else if (dow === 6 && !summer && n('gym') < keep(0.55)) {
      add(date, 'WeightTraining', 'Siłownia', clock(between(n('h'), 10, 12), n('m') * 60), 0, between(n('min'), 45, 70), 0, between(n('hr'), 110, 128), 'gym');
    }
    if (dow === 3 && n('swim') < keep(0.35)) {
      const km = between(n('km'), 1.5, 2.5);
      add(date, 'Swim', 'Basen', clock(between(n('h'), 18, 20), n('m') * 60), km, km * between(n('pace'), 21, 25), 0, undefined, 'swim');
    }
    if (dow === 1 && n('yoga') < keep(0.3)) {
      add(date, 'Yoga', 'Joga wieczorna', clock(20, n('m') * 30), 0, between(n('min'), 35, 50), 0, undefined, 'yoga');
    }
    if ((dow === 5 || dow === 6) && n('walk') < 0.3) {
      const km = between(n('km'), 3.5, 8);
      const name = n('planty') < 0.5 ? 'Spacer po Plantach' : 'Spacer bulwarami';
      add(date, 'Walk', name, clock(between(n('h'), 16, 19), n('m') * 60), km, km * between(n('pace'), 11, 13), between(n('el'), 5, 40), undefined, 'walk');
    }
    if (dow === 6 && summer && n('hike') < 0.12) {
      const km = between(n('km'), 12, 20);
      add(date, 'Hike', 'Wycieczka w Tatry', clock(7, n('m') * 60), km, km * between(n('pace'), 17, 22), between(n('el'), 900, 1450), between(n('hr'), 118, 135), 'hike');
    }
  }

  // This morning's run, so the evening check-in can pick it up straight away.
  add(today, 'Run', 'Poranny bieg', '07:10', 5.2, 5.2 * 5.55, 42, 151, 'today');

  return activities.sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start));
}
