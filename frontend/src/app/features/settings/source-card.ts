import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SourceInfo } from '../../core/models/metrics.model';
import { SourcesStore } from '../../core/state/sources.store';
import { SyncStore } from '../../core/state/sync.store';
import { Icon } from '../../shared/icon/icon';

/** How long the fake "redirect to Garmin" takes before the OAuth callback page. */
const REDIRECT_MS = 1200;

/**
 * One data source: connect (with a consent primer before the provider's login page),
 * sync, disconnect. Native-only sources explain why they're not available on the web.
 */
@Component({
  selector: 'app-source-card',
  imports: [Icon],
  templateUrl: './source-card.html',
  styleUrl: './source-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SourceCard {
  private readonly sources = inject(SourcesStore);
  protected readonly sync = inject(SyncStore);
  private readonly router = inject(Router);

  readonly source = input.required<SourceInfo>();
  /** Where the OAuth callback should send the user back to. */
  readonly returnTo = input('/');

  protected readonly connected = computed(() => this.sources.isConnected(this.source().id));
  protected readonly primary = computed(() => this.sources.primary()?.id === this.source().id);
  protected readonly step = signal<'idle' | 'consent' | 'redirecting'>('idle');
  /** Data types the user agreed to share — all on by default, each can be switched off. */
  protected readonly allowed = signal<ReadonlySet<string>>(new Set());

  protected openConsent(): void {
    this.allowed.set(new Set(this.source().reads));
    this.step.set('consent');
  }

  protected toggle(type: string): void {
    this.allowed.update((set) => {
      const next = new Set(set);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  protected goToProvider(): void {
    this.step.set('redirecting');
    setTimeout(() => {
      this.router.navigate(['/onboarding/done'], {
        queryParams: { source: this.source().id, returnTo: this.returnTo() },
      });
    }, REDIRECT_MS);
  }

  protected disconnect(): void {
    this.sources.disconnect(this.source().id);
    this.step.set('idle');
    if (this.sources.primary()) this.sync.sync();
    else this.sync.clear();
  }
}
