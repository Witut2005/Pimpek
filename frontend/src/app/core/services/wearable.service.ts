import { inject, Injectable } from '@angular/core';
import { delay, mergeMap, Observable, of, throwError, timer } from 'rxjs';
import { wearableDay } from '../mocks/scenarios';
import { SourceId, WearableDay } from '../models/metrics.model';
import { ScenarioStore } from '../state/scenario.store';
import { addDays } from '../../shared/date';

/** Long enough for the jury to notice Pimpek "checking" the watch. */
const SYNC_LATENCY_MS = 2200;
const HISTORY_DAYS = 28;

/**
 * Stand-in for the backend's /api/wearables/sleep + /timeseries. Swap for an HttpClient
 * implementation once the Open Wearables ingestion is live.
 */
@Injectable({ providedIn: 'root' })
export class MockWearableService {
  private readonly scenario = inject(ScenarioStore);

  /** Demo switch: the next fetch fails, to show the error state. */
  failNext = false;

  fetchDays(source: SourceId, today: string): Observable<WearableDay[]> {
    if (this.failNext) {
      this.failNext = false;
      return timer(SYNC_LATENCY_MS).pipe(mergeMap(() => throwError(() => new Error('Garmin timeout'))));
    }
    const { scenario, anchor } = this.scenario.state();
    const days = Array.from({ length: HISTORY_DAYS }, (_, i) =>
      wearableDay(scenario, addDays(today, -i), today, anchor, source),
    );
    return of(days).pipe(delay(SYNC_LATENCY_MS));
  }
}
