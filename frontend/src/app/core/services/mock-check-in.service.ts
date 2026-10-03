import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { CheckInInput, DailyCheckIn } from '../models/check-in.model';
import { buildSeedCheckIns } from '../mocks/check-in.mocks';
import { buildCompanionReaction } from './companion-reaction';
import { CheckInService } from './check-in.service';
import { toDateKey } from '../../shared/date';

/** Simulated network latency, so loading states are visible. */
const LATENCY_MS = 350;

/** In-memory mock — every page reload starts from the seed data again. */
@Injectable()
export class MockCheckInService extends CheckInService {
  private checkIns = buildSeedCheckIns(toDateKey(new Date()));

  getCheckIns(): Observable<DailyCheckIn[]> {
    const sorted = [...this.checkIns].sort((a, b) => b.date.localeCompare(a.date));
    return of(structuredClone(sorted)).pipe(delay(LATENCY_MS));
  }

  getCheckIn(date: string): Observable<DailyCheckIn | undefined> {
    const found = this.checkIns.find((c) => c.date === date);
    return of(found && structuredClone(found)).pipe(delay(LATENCY_MS));
  }

  saveCheckIn(input: CheckInInput): Observable<DailyCheckIn> {
    const existing = this.checkIns.find((c) => c.date === input.date);
    const saved: DailyCheckIn = {
      ...structuredClone(input),
      id: existing?.id ?? `entry-${input.date}`,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      companionReaction: buildCompanionReaction(input),
    };
    this.checkIns = [...this.checkIns.filter((c) => c.date !== input.date), saved];
    return of(structuredClone(saved)).pipe(delay(LATENCY_MS));
  }
}
