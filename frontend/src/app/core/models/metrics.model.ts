import { IconName } from '../../shared/icon/icon';

export type SourceId = 'garmin' | 'fitatu' | 'oura' | 'apple-health' | 'health-connect';

export interface SourceInfo {
  id: SourceId;
  name: string;
  /** Short name and its genitive, for Pimpek's sentences ("Zaglądam do Garmina"). */
  short: string;
  genitive: string;
  icon: IconName;
  /** A wearable feeds sleep and steps; a food diary feeds the meals in the check-in. */
  kind: 'wearable' | 'diet';
  /** Apple Health and Health Connect have no web API — they need the native app. */
  web: boolean;
  /** Not wired to the backend yet — shown, but can't be connected. */
  soon?: boolean;
  /** Can also connect through the official OAuth via Open Wearables, not just e-mail and password. */
  oauth?: boolean;
  reads: readonly string[];
}

export const SOURCES: readonly SourceInfo[] = [
  {
    id: 'garmin',
    name: 'Garmin Connect',
    short: 'Garmin',
    genitive: 'Garmina',
    icon: 'watch',
    kind: 'wearable',
    web: true,
    oauth: true,
    reads: ['sen', 'kroki', 'tętno spoczynkowe', 'bieganie'],
  },
  {
    id: 'fitatu',
    name: 'Fitatu',
    short: 'Fitatu',
    genitive: 'Fitatu',
    icon: 'apple',
    kind: 'diet',
    web: true,
    reads: ['posiłki', 'kalorie', 'makroskładniki'],
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    short: 'Oura',
    genitive: 'Oury',
    icon: 'ring',
    kind: 'wearable',
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
    kind: 'wearable',
    web: false,
    reads: ['sen', 'kroki'],
  },
  {
    id: 'health-connect',
    name: 'Health Connect',
    short: 'Health Connect',
    genitive: 'Health Connect',
    icon: 'phone',
    kind: 'wearable',
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
  /** Phone screen time (Screen Time / Digital Wellbeing). Only the demo feeds it for now. */
  screenHours?: number;
  /** False for today: the day isn't over, steps keep growing. */
  complete: boolean;
}
