import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { SourceId, SourceInfo, SOURCES } from '../models/metrics.model';
import { ConnectionVia, WearableApi } from '../services/wearable-api';
import { KEYS, readJson, writeJson } from '../../shared/storage';

export interface Connection {
  id: SourceId;
  connectedAt: string;
  /** `demo` connections live only in the browser and are fed by the mock scenarios. */
  via: ConnectionVia | 'demo';
}

/**
 * Which wearables and food diaries are linked. The backend (GET /api/sources) is the source
 * of truth; localStorage only makes the first paint instant. Demo mode keeps its fake connection.
 */
@Injectable({ providedIn: 'root' })
export class SourcesStore {
  private readonly api = inject(WearableApi);

  readonly connections = signal<Connection[]>(readJson(KEYS.sources, []));
  /** False until the backend has answered once — avoids flashing "not connected". */
  readonly checked = signal(false);

  /** The first linked wearable feeds Pimpek; extra ones are listed but not merged yet. */
  readonly primary = computed(() => this.firstOf('wearable'));
  /** The food diary whose meals pre-fill the evening check-in. */
  readonly diet = computed(() => this.firstOf('diet'));
  readonly isDemo = computed(() => this.connections().some((c) => c.via === 'demo'));

  constructor() {
    effect(() => writeJson(KEYS.sources, this.connections()));
  }

  private firstOf(kind: SourceInfo['kind']): SourceInfo | undefined {
    for (const connection of this.connections()) {
      const info = SOURCES.find((s) => s.id === connection.id);
      if (info?.kind === kind) return info;
    }
    return undefined;
  }

  isConnected(id: SourceId): boolean {
    return this.connections().some((c) => c.id === id);
  }

  via(id: SourceId): Connection['via'] | undefined {
    return this.connections().find((c) => c.id === id)?.via;
  }

  /**
   * Re-reads the backend. Emits the new list; on network failure keeps what we had.
   * Demo connections stay, so a real Fitatu can sit next to the demo's fake Garmin.
   */
  refresh(): Observable<Connection[]> {
    const demo = this.connections().filter((c) => c.via === 'demo');
    return this.api.sources().pipe(
      map((list) => [
        ...demo,
        ...list
          .filter((s) => !demo.some((d) => d.id === s.id))
          .map((s) => ({ id: s.id, via: s.via, connectedAt: s.connectedAt ?? new Date().toISOString() })),
      ]),
      tap((list) => this.connections.set(list)),
      catchError(() => of(this.connections())),
      tap(() => this.checked.set(true)),
    );
  }

  disconnect(id: SourceId): Observable<unknown> {
    const drop = () => this.connections.update((list) => list.filter((c) => c.id !== id));
    if (this.via(id) === 'demo') {
      drop();
      return of(null);
    }
    return this.api.disconnect(id).pipe(tap(drop));
  }

  /** Demo mode only: real connections come from the backend. A real food diary stays linked. */
  replace(list: Connection[]): void {
    this.connections.update((current) => [
      ...list,
      ...current.filter((c) => c.via !== 'demo' && SOURCES.find((s) => s.id === c.id)?.kind === 'diet'),
    ]);
  }
}
