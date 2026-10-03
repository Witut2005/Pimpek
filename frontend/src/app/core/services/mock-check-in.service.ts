import { inject, Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { CheckInInput, DailyCheckIn } from '../models/check-in.model';
import { SettingsStore } from '../state/settings.store';
import { buildCompanionReaction } from './companion-reaction';
import { CheckInService } from './check-in.service';
import { KEYS, readJson, writeJson } from '../../shared/storage';

/** Simulated network latency, so loading states are visible. */
const LATENCY_MS = 350;

/**
 * Mock backend kept in localStorage, so a reload mid-pitch doesn't lose the demo.
 * Demo scenarios write the seed straight into the same key.
 */
@Injectable()
export class MockCheckInService extends CheckInService {
  private readonly settings = inject(SettingsStore);

  private read(): DailyCheckIn[] {
    return readJson<DailyCheckIn[]>(KEYS.checkIns, []);
  }

  getCheckIns(): Observable<DailyCheckIn[]> {
    const sorted = this.read().sort((a, b) => b.date.localeCompare(a.date));
    return of(sorted).pipe(delay(LATENCY_MS));
  }

  getCheckIn(date: string): Observable<DailyCheckIn | undefined> {
    return of(this.read().find((c) => c.date === date)).pipe(delay(LATENCY_MS));
  }

  saveCheckIn(input: CheckInInput): Observable<DailyCheckIn> {
    const checkIns = this.read();
    const existing = checkIns.find((c) => c.date === input.date);
    const saved: DailyCheckIn = {
      ...structuredClone(input),
      id: existing?.id ?? `entry-${input.date}`,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      companionReaction: buildCompanionReaction(input, this.settings.goals()),
    };
    writeJson(KEYS.checkIns, [...checkIns.filter((c) => c.date !== input.date), saved]);
    return of(structuredClone(saved)).pipe(delay(LATENCY_MS));
  }
}
