import { inject, Injectable } from '@angular/core';
import { concat, concatMap, delay, from, map, Observable, of } from 'rxjs';
import { buildStravaHistory, mockAthlete } from '../mocks/strava.mocks';
import { StravaActivity, StravaImport } from '../models/strava.model';
import { ClockStore } from '../state/clock.store';

/** Strava pages activities; a small page keeps the import progress visible in the demo. */
const PAGE_SIZE = 30;

export type ImportPhase = 'token' | 'profile' | 'activities' | 'analysis';

export interface ImportProgress {
  phase: ImportPhase;
  page: number;
  pages: number;
  /** Running totals of what has arrived so far. */
  activities: number;
  km: number;
}

export type ImportEvent = { progress: ImportProgress } | { result: StravaImport };

const sumKm = (list: readonly StravaActivity[]) => list.reduce((sum, a) => sum + a.distanceKm, 0);

/**
 * Mock of the Strava connection. The real flow it stands in for:
 *  1. backend: POST /api/strava/connect → Strava authorize URL (scopes: read, activity:read_all)
 *  2. Strava redirects to /onboarding/done?source=strava&code=… → backend exchanges the code
 *     at POST https://www.strava.com/oauth/token and keeps the refresh token
 *  3. backend: GET /api/strava/activities?after=<epoch> pages through
 *     GET https://www.strava.com/api/v3/athlete/activities?per_page=200&page=N
 * Here every step is simulated with delays, so the UI can be built and demoed today.
 */
@Injectable({ providedIn: 'root' })
export class MockStravaService {
  private readonly clock = inject(ClockStore);

  /** Placeholder for the OAuth round trip. Accepts any e-mail; nothing leaves the browser. */
  authorize(email: string): Observable<{ firstName: string }> {
    return of({ firstName: mockAthlete(email).firstName }).pipe(delay(1100));
  }

  /** Backfills `months` of history, emitting progress per page, then the full import. */
  importHistory(email: string, months: number): Observable<ImportEvent> {
    const today = this.clock.today();
    const athlete = mockAthlete(email);
    const activities = buildStravaHistory(today, months);
    const pages = Math.max(1, Math.ceil(activities.length / PAGE_SIZE));
    const step = (phase: ImportPhase, page: number, upTo: number, ms: number) =>
      of<ImportEvent>({
        progress: {
          phase,
          page,
          pages,
          activities: upTo,
          km: sumKm(activities.slice(0, upTo)),
        },
      }).pipe(delay(ms));

    return concat(
      step('token', 0, 0, 500),
      step('profile', 0, 0, 700),
      from(Array.from({ length: pages }, (_, i) => i + 1)).pipe(
        concatMap((page) =>
          step('activities', page, Math.min(activities.length, page * PAGE_SIZE), 320),
        ),
      ),
      step('analysis', pages, activities.length, 900),
      of({ athlete, activities, months, importedAt: new Date().toISOString() }).pipe(
        delay(500),
        map((result): ImportEvent => ({ result })),
      ),
    );
  }

  /** "Sync now" on a connected Strava: re-reads the last days (here: the same mock history). */
  refresh(current: StravaImport): Observable<StravaImport> {
    const activities = buildStravaHistory(this.clock.today(), current.months);
    return of({ ...current, activities, importedAt: new Date().toISOString() }).pipe(delay(1200));
  }
}
