import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { FoodCheck, FoodRating, MealDay, RatingRequest } from '../models/meals.model';
import { SourceId, WearableDay } from '../models/metrics.model';
import { ProfileAnswer, ProfileRequest } from '../models/profile.model';

const HISTORY_DAYS = 28;

/** How the backend reaches a source: Garmin via Open Wearables OAuth or its direct login; Fitatu by login. */
export type ConnectionVia = 'open_wearables' | 'garmin_connect' | 'fitatu';

export interface ApiSource {
  id: SourceId;
  via: ConnectionVia;
  connectedAt: string | null;
  name?: string | null;
}

interface ApiDay {
  date: string;
  source: SourceId;
  sleepHours: number | null;
  sleepScore: number | null;
  steps: number | null;
  restingHr: number | null;
  runningKm: number | null;
  complete: boolean;
}

/** Only Garmin ever asks for MFA. */
export type LoginResult =
  | { status: 'connected' }
  | { status: 'mfa_required'; mfa_session: string };

const orUndefined = <T>(value: T | null): T | undefined => value ?? undefined;

/** The FastAPI backend (`/api`, proxied in dev). Identity is a per-browser X-User-Id (user-id.interceptor.ts). */
@Injectable({ providedIn: 'root' })
export class WearableApi {
  private readonly http = inject(HttpClient);

  sources(): Observable<ApiSource[]> {
    return this.http.get<ApiSource[]>('/api/sources');
  }

  disconnect(id: SourceId): Observable<unknown> {
    return this.http.delete(`/api/sources/${id}`);
  }

  /** Newest first. Days the watch knows nothing about are left out. */
  fetchDays(today: string): Observable<WearableDay[]> {
    return this.http
      .get<{ days: ApiDay[] }>('/api/days', { params: { count: HISTORY_DAYS, today } })
      .pipe(
        map(({ days }) =>
          days
            .filter((d) => d.sleepHours !== null || d.steps !== null)
            .map((d) => ({
              date: d.date,
              source: d.source,
              sleepHours: orUndefined(d.sleepHours),
              sleepScore: orUndefined(d.sleepScore),
              steps: d.steps ?? 0,
              restingHr: orUndefined(d.restingHr),
              runningKm: orUndefined(d.runningKm),
              complete: d.complete,
            })),
        ),
      );
  }

  /** E-mail and password login to Garmin or Fitatu. The backend keeps only the session tokens. */
  login(id: SourceId, email: string, password: string): Observable<LoginResult> {
    return this.http.post<LoginResult>(`/api/${id}/connect`, { email, password });
  }

  garminMfa(mfaSession: string, code: string): Observable<LoginResult> {
    return this.http.post<LoginResult>('/api/garmin/mfa', { mfa_session: mfaSession, code });
  }

  /** The day's meals from the connected food diary (Fitatu). 409 when none is connected. */
  fetchMeals(date: string): Observable<MealDay> {
    return this.http.get<MealDay>('/api/meals', { params: { date } });
  }

  /** Gemini's rating of the day's food. 503 when the backend has no Gemini key. */
  rateFood(request: RatingRequest): Observable<FoodRating> {
    return this.http
      .post<Omit<FoodRating, 'source'>>('/api/food/rating', request)
      .pipe(map((rating) => ({ ...rating, source: 'ai' as const })));
  }

  /** Gemini's read of the recent check-ins and notes. 503 when the backend has no Gemini key. */
  summarizeProfile(request: ProfileRequest): Observable<ProfileAnswer> {
    return this.http.post<ProfileAnswer>('/api/profile/summary', request);
  }

  /** Whether a food typed in by hand is food at all. Fails (errors) when the AI is off. */
  checkFood(name: string, amount?: string): Observable<FoodCheck> {
    return this.http.post<FoodCheck>('/api/food/check', { name, amount });
  }

  /** Asks Garmin to push up to 30 days of history to Open Wearables (arrives via webhook). */
  garminBackfill(): Observable<unknown> {
    return this.http.post('/api/wearables/garmin/backfill', {});
  }

  /** Watches that can be connected through Open Wearables right now (their OAuth keys are set). */
  availableOauth(): Observable<SourceId[]> {
    return this.http.get<{ oauth: SourceId[] }>('/api/sources/available').pipe(map((r) => r.oauth));
  }

  /** Pull providers (Polar, Fitbit, Oura…): ask Open Wearables to fetch fresh data now. */
  owSync(id: SourceId): Observable<unknown> {
    return this.http.post(`/api/wearables/${id}/sync`, {});
  }

  /** Official Garmin OAuth through Open Wearables. Resolves to the provider's login page. */
  oauthUrl(id: SourceId, returnTo: string): Observable<string> {
    const redirect = new URL('/onboarding/done', location.origin);
    redirect.searchParams.set('source', id);
    redirect.searchParams.set('returnTo', returnTo);
    return this.http
      .post<{ authorization_url: string }>(`/api/wearables/connect/${id}`, {
        redirect_uri: redirect.toString(),
      })
      .pipe(map((r) => r.authorization_url));
  }
}
