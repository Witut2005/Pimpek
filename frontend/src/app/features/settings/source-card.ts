import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SourceInfo } from '../../core/models/metrics.model';
import { GarminLoginResult, WearableApi } from '../../core/services/wearable-api';
import { SourcesStore } from '../../core/state/sources.store';
import { SyncStore } from '../../core/state/sync.store';
import { Icon } from '../../shared/icon/icon';

type Step = 'idle' | 'consent' | 'login' | 'mfa' | 'busy' | 'redirecting';

/** Turns a backend error into something Pimpek can say. */
function explain(err: unknown): string {
  const status = err instanceof HttpErrorResponse ? err.status : 0;
  switch (status) {
    case 401:
      return 'Garmin nie przyjął e-maila lub hasła. Sprawdź je i spróbuj jeszcze raz.';
    case 410:
      return 'Kod wygasł. Zaloguj się jeszcze raz, Garmin wyśle nowy.';
    case 429:
      return 'Garmin prosi o chwilę przerwy. Spróbuj za kilka minut.';
    case 503:
      return 'Open Wearables nie działa. Użyj logowania e-mailem powyżej.';
    case 0:
      return 'Nie mogę połączyć się z serwerem Pimpka. Czy backend działa?';
    default:
      return 'Nie udało się połączyć z Garminem. Spróbuj ponownie za chwilę.';
  }
}

/**
 * One data source: consent primer → Garmin login (with MFA), or the official OAuth via
 * Open Wearables; then sync and disconnect. Native-only sources explain why they're not on the web.
 */
@Component({
  selector: 'app-source-card',
  imports: [Icon, FormsModule],
  templateUrl: './source-card.html',
  styleUrl: './source-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SourceCard {
  private readonly sources = inject(SourcesStore);
  private readonly api = inject(WearableApi);
  protected readonly sync = inject(SyncStore);

  readonly source = input.required<SourceInfo>();
  /** Where the OAuth callback should send the user back to. */
  readonly returnTo = input('/');

  protected readonly connected = computed(() => this.sources.isConnected(this.source().id));
  protected readonly primary = computed(() => this.sources.primary()?.id === this.source().id);
  protected readonly available = computed(() => this.source().web && !this.source().soon);
  protected readonly step = signal<Step>('idle');
  protected readonly error = signal('');

  protected email = '';
  protected password = '';
  protected code = '';
  private mfaSession = '';

  protected start(): void {
    this.error.set('');
    this.step.set('consent');
  }

  protected cancel(): void {
    this.password = '';
    this.code = '';
    this.error.set('');
    this.step.set('idle');
  }

  protected login(): void {
    if (!this.email.trim() || !this.password) return;
    this.run('login', this.api.garminLogin(this.email.trim(), this.password));
  }

  protected submitCode(): void {
    if (!this.code.trim()) return;
    this.run('mfa', this.api.garminMfa(this.mfaSession, this.code.trim()));
  }

  /** Official Garmin OAuth through Open Wearables — leaves the app and comes back to /onboarding/done. */
  protected oauth(): void {
    this.error.set('');
    this.step.set('redirecting');
    this.api.oauthUrl(this.source().id, this.returnTo()).subscribe({
      next: (url) => location.assign(url),
      error: (err) => {
        this.error.set(explain(err));
        this.step.set('login');
      },
    });
  }

  protected disconnect(): void {
    this.sources.disconnect(this.source().id).subscribe({
      next: () => {
        this.step.set('idle');
        if (this.sources.primary()) this.sync.sync();
        else this.sync.clear();
      },
      error: (err) => this.error.set(explain(err)),
    });
  }

  private run(from: 'login' | 'mfa', request: ReturnType<WearableApi['garminLogin']>): void {
    this.error.set('');
    this.step.set('busy');
    request.subscribe({
      next: (result: GarminLoginResult) => {
        if (result.status === 'mfa_required') {
          this.mfaSession = result.mfa_session;
          this.code = '';
          this.step.set('mfa');
          return;
        }
        this.password = '';
        this.sources.refresh().subscribe(() => {
          this.step.set('idle');
          this.sync.sync();
        });
      },
      error: (err) => {
        this.error.set(explain(err));
        // An expired MFA session can't be retried with a new code — start the login over.
        this.step.set(from === 'mfa' && (err as HttpErrorResponse).status !== 410 ? 'mfa' : 'login');
      },
    });
  }
}
