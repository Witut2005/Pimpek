import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { SourceId, SOURCES } from '../models/metrics.model';
import { ConnectionVia, WearableApi } from '../services/wearable-api';
import { KEYS, readJson, writeJson } from '../../shared/storage';

export interface Connection {
  id: SourceId;
  connectedAt: string;
  /** `demo` connections live only in the browser and are fed by the mock scenarios. */
  via: ConnectionVia | 'demo';
}

/**
 * Which wearables are linked. The backend (GET /api/sources) is the source of truth;
 * localStorage only makes the first paint instant. Demo mode keeps its fake connection.
 */
@Injectable({ providedIn: 'root' })
export class SourcesStore {
  private readonly api = inject(WearableApi);

  readonly connections = signal<Connection[]>(readJson(KEYS.sources, []));
  /** False until the backend has answered once — avoids flashing "not connected". */
  readonly checked = signal(false);

  /** The first linked source feeds Pimpek; extra ones are listed but not merged yet. */
  readonly primary = computed(() => {
    const first = this.connections()[0];
    return first && SOURCES.find((s) => s.id === first.id);
  });
  readonly isDemo = computed(() => this.connections().some((c) => c.via === 'demo'));

  constructor() {
    effect(() => writeJson(KEYS.sources, this.connections()));
  }

  isConnected(id: SourceId): boolean {
    return this.connections().some((c) => c.id === id);
  }

  via(id: SourceId): Connection['via'] | undefined {
    return this.connections().find((c) => c.id === id)?.via;
  }

  /** Re-reads the backend. Emits the new list; on network failure keeps what we had. */
  refresh(): Observable<Connection[]> {
    if (this.isDemo()) {
      this.checked.set(true);
      return of(this.connections());
    }
    return this.api.sources().pipe(
      map((list) =>
        list.map((s) => ({ id: s.id, via: s.via, connectedAt: s.connectedAt ?? new Date().toISOString() })),
      ),
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

  /** Demo mode only: real connections come from the backend. */
  replace(list: Connection[]): void {
    this.connections.set(list);
  }
}
