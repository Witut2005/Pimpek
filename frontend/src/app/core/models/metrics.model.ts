import { IconName } from '../../shared/icon/icon';

export type SourceId = 'garmin' | 'oura' | 'apple-health' | 'health-connect';

export interface SourceInfo {
  id: SourceId;
  name: string;
  /** Short name and its genitive, for Pimpek's sentences ("Zaglądam do Garmina"). */
  short: string;
  genitive: string;
  icon: IconName;
  /** Apple Health and Health Connect have no web API — they need the native app. */
  web: boolean;
  /** Not wired to the backend yet — shown, but can't be connected. */
  soon?: boolean;
  reads: readonly string[];
}

export const SOURCES: readonly SourceInfo[] = [
  {
    id: 'garmin',
    name: 'Garmin Connect',
    short: 'Garmin',
    genitive: 'Garmina',
    icon: 'watch',
    web: true,
    reads: ['sen', 'kroki', 'tętno spoczynkowe', 'bieganie'],
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    short: 'Oura',
    genitive: 'Oury',
    icon: 'ring',
    web: true,
    soon: true,
    reads: ['sen', 'kroki', 'tętno spoczynkowe'],
  },
  {
    id: 'apple-health',
    name: 'Apple Health',
    short: 'Apple Health',
    genitive: 'Apple Health',
    icon: 'heart',
    web: false,
    reads: ['sen', 'kroki'],
  },
  {
    id: 'health-connect',
    name: 'Health Connect',
    short: 'Health Connect',
    genitive: 'Health Connect',
    icon: 'phone',
    web: false,
    reads: ['sen', 'kroki'],
  },
];

/** One day as measured by a wearable — what the backend will normalise Garmin/Oura data into. */
export interface WearableDay {
  /** Local calendar day, `YYYY-MM-DD`. Sleep belongs to the day you woke up. */
  date: string;
  source: SourceId;
  /** Absent when the watch wasn't worn overnight — never treat that as zero sleep. */
  sleepHours?: number;
  /** Garmin's 0–100 sleep score, when the watch provides one. */
  sleepScore?: number;
  steps: number;
  restingHr?: number;
  /** Kilometres run that day, from the watch's recorded runs. */
  runningKm?: number;
  /** False for today: the day isn't over, steps keep growing. */
  complete: boolean;
}
