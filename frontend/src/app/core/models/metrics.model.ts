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
    reads: ['sen', 'kroki', 'tętno spoczynkowe'],
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    short: 'Oura',
    genitive: 'Oury',
    icon: 'ring',
    web: true,
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
  sleepHours: number;
  steps: number;
  restingHr: number;
  /** False for today: the day isn't over, steps keep growing. */
  complete: boolean;
}
