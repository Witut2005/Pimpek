import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { SourceInfo } from '../../core/models/metrics.model';
import { MockStravaService } from '../../core/services/strava.service';
import { LoginResult, WearableApi } from '../../core/services/wearable-api';
import { SourcesStore } from '../../core/state/sources.store';
import { StravaStore } from '../../core/state/strava.store';
import { SyncStore } from '../../core/state/sync.store';
import { formatSteps, sinceLabel } from '../../shared/format';
import { Icon } from '../../shared/icon/icon';
import { StravaConnect } from '../strava/strava-connect';

type Step = 'idle' | 'consent' | 'login' | 'mfa' | 'busy' | 'redirecting';

/** Turns a backend error into something Pimpek can say. */
function explain(err: unknown, source: SourceInfo): string {
  const status = err instanceof HttpErrorResponse ? err.status : 0;
  // Every backend error carries FastAPI's JSON `detail`. A 5xx without it comes from the dev
  // proxy (backend not running, or on another port) — not from the source.
  const fromBackend = err instanceof HttpErrorResponse && typeof err.error?.detail === 'string';
  if (status >= 500 && !fromBackend) return 'Nie mogę połączyć się z serwerem Pimpka. Czy backend działa?';
  switch (status) {
    case 401:
      return `${source.short} nie rozpoznaje tego e-maila lub hasła. Sprawdź je i spróbuj jeszcze raz.`;
    case 410:
      return `Kod wygasł. Zaloguj się jeszcze raz, ${source.short} wyśle nowy.`;
    case 429:
      return `${source.short} prosi o chwilę przerwy. Spróbuj za kilka minut.`;
    case 503:
      return 'Open Wearables nie działa. Użyj logowania e-mailem powyżej.';
    case 0:
      return 'Nie mogę połączyć się z serwerem Pimpka. Czy backend działa?';
    default:
      return `Nie udało się połączyć z ${source.short}. Spróbuj ponownie za chwilę.`;
  }
}

/**
 * One data source: consent primer → e-mail login (Garmin may add MFA), or for Garmin the
 * official OAuth via Open Wearables; then sync and disconnect. Native-only sources explain
 * why they're not on the web.
 */
@Component({
  selector: 'app-source-card',
  imports: [Icon, FormsModule, StravaConnect],
  templateUrl: './source-card.html',
  styleUrl: './source-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SourceCard {
  private readonly sources = inject(SourcesStore);
  private readonly api = inject(WearableApi);
  protected readonly sync = inject(SyncStore);
  protected readonly strava = inject(StravaStore);
  private readonly stravaApi = inject(MockStravaService);
  /** Looked up by name, not class, so the flow's code stays in its own lazy chunk. */
  private readonly stravaFlow = viewChild<{ open(): void }>('stravaFlow');

  readonly source = input.required<SourceInfo>();
  /** Where the OAuth callback should send the user back to. */
  readonly returnTo = input('/');

  protected readonly connected = computed(() => this.sources.isConnected(this.source().id));
  protected readonly primary = computed(() => this.sources.primary()?.id === this.source().id);
  protected readonly isDiet = computed(() => this.source().kind === 'diet');
  /** OAuth through Open Wearables works only once the backend has that provider's keys. */
  protected readonly oauthReady = computed(() => this.sources.oauthReady().has(this.source().id));
  protected readonly available = computed(
    () => this.source().web && !this.source().soon && (!this.source().oauthOnly || this.oauthReady()),
  );
  protected readonly step = signal<Step>('idle');
  protected readonly error = signal('');
  /** Sources without a backend yet (Strava) run their own full-screen mock flow. */
  protected readonly isMock = computed(() => !!this.source().mock);
  protected readonly mockSyncing = signal(false);
  protected readonly stravaLine = computed(() => {
    const { count, km } = this.strava.totals();
    return `${count} treningów · ${formatSteps(km)} km · zsynchronizowano ${sinceLabel(this.strava.data()?.importedAt, this.sync.now())}`;
  });

  protected email = '';
  protected password = '';
  protected code = '';
  private mfaSession = '';

  protected start(): void {
    this.error.set('');
    if (this.isMock()) {
      this.stravaFlow()?.open();
      return;
    }
    this.step.set('consent');
  }

  /** After consent: watches without an e-mail login go straight to their OAuth page. */
  protected consentGiven(): void {
    if (this.source().oauthOnly) this.oauth();
    else this.step.set('login');
  }

  /** "Sync now" for the Strava mock: re-reads the recent workouts. */
  protected syncMock(): void {
    const current = this.strava.data();
    if (!current || this.mockSyncing()) return;
    this.mockSyncing.set(true);
    this.stravaApi.refresh(current).subscribe((data) => {
      this.strava.save(data);
      this.mockSyncing.set(false);
    });
  }

  protected cancel(): void {
    this.password = '';
    this.code = '';
    this.error.set('');
    this.step.set('idle');
  }

  protected login(): void {
    if (!this.email.trim() || !this.password) return;
    this.run('login', this.api.login(this.source().id, this.email.trim(), this.password));
  }

  protected submitCode(): void {
    if (!this.code.trim()) return;
    this.run('mfa', this.api.garminMfa(this.mfaSession, this.code.trim()));
  }

  /** Official OAuth through Open Wearables — leaves the app and comes back to /onboarding/done. */
  protected oauth(): void {
    this.error.set('');
    this.step.set('redirecting');
    this.api.oauthUrl(this.source().id, this.returnTo()).subscribe({
      next: (url) => location.assign(url),
      error: (err) => {
        this.error.set(explain(err, this.source()));
        // OAuth-only watches have no e-mail form to fall back to.
        this.step.set(this.source().oauthOnly ? 'consent' : 'login');
      },
    });
  }

  protected disconnect(): void {
    this.sources.disconnect(this.source().id).subscribe({
      next: () => {
        this.step.set('idle');
        if (this.isMock()) {
          this.strava.clear();
          return;
        }
        // Meals are fetched per check-in, so only a wearable leaves synced data behind.
        if (this.isDiet()) return;
        if (this.sources.primary()) this.sync.sync();
        else this.sync.clear();
      },
      error: (err) => this.error.set(explain(err, this.source())),
    });
  }

  private run(from: 'login' | 'mfa', request: Observable<LoginResult>): void {
    this.error.set('');
    this.step.set('busy');
    request.subscribe({
      next: (result) => {
        if (result.status === 'mfa_required') {
          this.mfaSession = result.mfa_session;
          this.code = '';
          this.step.set('mfa');
          return;
        }
        this.password = '';
        this.sources.refresh().subscribe(() => {
          this.step.set('idle');
          if (!this.isDiet()) this.sync.sync();
        });
      },
      error: (err) => {
        this.error.set(explain(err, this.source()));
        // An expired MFA session can't be retried with a new code — start the login over.
        this.step.set(from === 'mfa' && (err as HttpErrorResponse).status !== 410 ? 'mfa' : 'login');
      },
    });
  }
}
