import { HttpErrorResponse } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { WearableDay } from '../models/metrics.model';
import { WearableApi } from '../services/wearable-api';
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
/** While the app is open (or comes back to the foreground), pull new watch data this often. */
const AUTO_SYNC_MS = 30 * 60 * 1000;

/**
 * Stale-while-revalidate for wearable data: the room renders from the cache instantly,
 * then Pimpek "checks the watch" in the background.
 */
@Injectable({ providedIn: 'root' })
export class SyncStore {
  private readonly api = inject(WearableApi);
  private readonly mock = inject(MockWearableService);
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
    setInterval(() => {
      this.now.set(Date.now());
      this.autoSync();
    }, 30_000);
    document.addEventListener('visibilitychange', () => this.autoSync());
  }

  /** Background refresh — the user never has to press anything to see last night's sleep. */
  private autoSync(): void {
    // After an error we wait for the user (or the network coming back) instead of hammering Garmin.
    if (document.hidden || this.phase() !== 'idle' || this.sources.isDemo()) return;
    const at = this.syncedAt();
    if (!at || Date.now() - new Date(at).getTime() > AUTO_SYNC_MS) this.sync();
  }

  sync(): void {
    const source = this.sources.primary();
    if (!source || !this.online()) return;
    this.request?.unsubscribe();
    this.phase.set('syncing');
    const today = this.clock.today();
    const days$ = this.sources.isDemo()
      ? this.mock.fetchDays(source.id, today)
      : this.api.fetchDays(today);
    this.request = days$.subscribe({
      next: (days) => {
        this.cache.set({ days, syncedAt: new Date().toISOString() });
        this.now.set(Date.now());
        this.phase.set('idle');
      },
      error: (err: unknown) => {
        // 409: the backend no longer has a connection (e.g. Garmin session expired).
        if (err instanceof HttpErrorResponse && err.status === 409) {
          this.sources.refresh().subscribe(() => this.clear());
          return;
        }
        this.phase.set('error');
      },
    });
  }

  clear(): void {
    this.request?.unsubscribe();
    this.cache.set({ days: [] });
    this.phase.set('idle');
  }
}
