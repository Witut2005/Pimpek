import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { SportType, SPORTS, StravaActivity, StravaImport } from '../models/strava.model';
import { ClockStore } from './clock.store';
import { addDays } from '../../shared/date';
import { KEYS, readJson, writeJson } from '../../shared/storage';

interface StravaState {
  data?: StravaImport;
}

export interface SportShare {
  sport: SportType;
  label: string;
  emoji: string;
  count: number;
  km: number;
  minutes: number;
}

export interface TrainingRecords {
  longestRun?: StravaActivity;
  /** Best pace (min/km) over runs of at least 5 km. */
  fastestRun?: StravaActivity;
  biggestClimb?: StravaActivity;
  longestRide?: StravaActivity;
}

export const pace = (a: StravaActivity) => (a.distanceKm ? a.movingMinutes / a.distanceKm : Infinity);

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

const maxBy = <T>(list: readonly T[], score: (item: T) => number): T | undefined =>
  list.reduce<T | undefined>((best, item) => (best === undefined || score(item) > score(best) ? item : best), undefined);

/** Imported Strava history plus everything the views derive from it. */
@Injectable({ providedIn: 'root' })
export class StravaStore {
  private readonly clock = inject(ClockStore);
  private readonly state = signal<StravaState>(readJson(KEYS.strava, {}));

  readonly data = computed(() => this.state().data);
  readonly connected = computed(() => !!this.data());
  /** Only what has happened by "today" — the demo clock can be wound back after an import. */
  readonly activities = computed(() => (this.data()?.activities ?? []).filter((a) => a.date <= this.clock.today()));

  /** Kilometres run per day: these count towards Pimpek's fitness and the headband. */
  readonly runKmByDate = computed(() => {
    const byDate = new Map<string, number>();
    for (const a of this.activities()) {
      if (a.sport === 'Run') byDate.set(a.date, (byDate.get(a.date) ?? 0) + a.distanceKm);
    }
    return byDate;
  });

  readonly totals = computed(() => {
    const list = this.activities();
    return {
      count: list.length,
      km: list.reduce((s, a) => s + a.distanceKm, 0),
      hours: list.reduce((s, a) => s + a.movingMinutes, 0) / 60,
      elevation: list.reduce((s, a) => s + a.elevationM, 0),
    };
  });

  readonly bySport = computed<SportShare[]>(() => {
    const shares = new Map<SportType, SportShare>();
    for (const a of this.activities()) {
      const share = shares.get(a.sport) ?? { sport: a.sport, ...SPORTS[a.sport], count: 0, km: 0, minutes: 0 };
      share.count++;
      share.km += a.distanceKm;
      share.minutes += a.movingMinutes;
      shares.set(a.sport, share);
    }
    return [...shares.values()].sort((a, b) => b.minutes - a.minutes);
  });

  readonly records = computed<TrainingRecords>(() => {
    const list = this.activities();
    const runs = list.filter((a) => a.sport === 'Run');
    return {
      longestRun: maxBy(runs, (a) => a.distanceKm),
      fastestRun: maxBy(runs.filter((a) => a.distanceKm >= 5), (a) => -pace(a)),
      biggestClimb: maxBy(list, (a) => a.elevationM),
      longestRide: maxBy(list.filter((a) => a.sport === 'Ride'), (a) => a.distanceKm),
    };
  });

  /** The month with the most training time, as a friendly sentence fragment. */
  readonly bestMonth = computed(() => {
    const minutes = new Map<string, number>();
    for (const a of this.activities()) {
      const key = a.date.slice(0, 7);
      minutes.set(key, (minutes.get(key) ?? 0) + a.movingMinutes);
    }
    const best = maxBy([...minutes.entries()], ([, m]) => m);
    return best && { label: MONTHS[Number(best[0].slice(5, 7)) - 1], hours: best[1] / 60 };
  });

  /** Kilometres per week for the last 12 weeks, oldest first; the last one is this week so far. */
  readonly weeklyKm = computed(() => {
    const today = this.clock.today();
    return Array.from({ length: 12 }, (_, i) => {
      const end = addDays(today, -7 * (11 - i));
      const start = addDays(end, -6);
      const km = this.activities()
        .filter((a) => a.date >= start && a.date <= end)
        .reduce((s, a) => s + a.distanceKm, 0);
      return { start, end, km };
    });
  });

  readonly recent = computed(() => this.activities().slice(0, 6));

  constructor() {
    effect(() => writeJson(KEYS.strava, this.state()));
  }

  save(data: StravaImport): void {
    this.state.set({ data });
  }

  clear(): void {
    this.state.set({});
  }
}
