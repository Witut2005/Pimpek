import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { WearableDay } from '../models/metrics.model';
import { MockWearableService } from '../services/wearable.service';
import { ClockStore } from './clock.store';
import { SourcesStore } from './sources.store';
import { sinceLabel } from '../../shared/format';
import { KEYS, readJson, writeJson } from '../../shared/storage';

export type SyncStatus = 'disconnected' | 'syncing' | 'ok' | 'error' | 'offline';

interface WearableCache {
  days: WearableDay[];
  syncedAt?: string;
}

const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

/**
 * Stale-while-revalidate for wearable data: the room renders from the cache instantly,
 * then Pimpek "checks the watch" in the background.
 */
@Injectable({ providedIn: 'root' })
export class SyncStore {
  private readonly api = inject(MockWearableService);
  private readonly sources = inject(SourcesStore);
  private readonly clock = inject(ClockStore);

  private readonly cache = signal<WearableCache>(readJson(KEYS.wearable, { days: [] }));
  private readonly phase = signal<'idle' | 'syncing' | 'error'>('idle');
  private readonly online = signal(navigator.onLine);
  private request?: Subscription;

  /** Ticks every 30 s so "5 min temu" stays honest. */
  readonly now = signal(Date.now());

  readonly days = computed(() => (this.sources.primary() ? this.cache().days : []));
  readonly syncedAt = computed(() => this.cache().syncedAt);
  readonly since = computed(() => sinceLabel(this.syncedAt(), this.now()));
  readonly stale = computed(() => {
    const at = this.syncedAt();
    return !at || this.now() - new Date(at).getTime() > STALE_AFTER_MS;
  });

  readonly status = computed<SyncStatus>(() => {
    if (!this.sources.primary()) return 'disconnected';
    if (!this.online()) return 'offline';
    const phase = this.phase();
    return phase === 'idle' ? 'ok' : phase;
  });

  constructor() {
    effect(() => writeJson(KEYS.wearable, this.cache()));
    addEventListener('online', () => {
      this.online.set(true);
      this.sync();
    });
    addEventListener('offline', () => this.online.set(false));
    setInterval(() => this.now.set(Date.now()), 30_000);
  }

  sync(): void {
    const source = this.sources.primary();
    if (!source || !this.online()) return;
    this.request?.unsubscribe();
    this.phase.set('syncing');
    this.request = this.api.fetchDays(source.id, this.clock.today()).subscribe({
      next: (days) => {
        this.cache.set({ days, syncedAt: new Date().toISOString() });
        this.now.set(Date.now());
        this.phase.set('idle');
      },
      error: () => this.phase.set('error'),
    });
  }

  clear(): void {
    this.request?.unsubscribe();
    this.cache.set({ days: [] });
    this.phase.set('idle');
  }
}
