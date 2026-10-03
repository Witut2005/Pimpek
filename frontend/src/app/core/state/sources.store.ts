import { computed, effect, Injectable, signal } from '@angular/core';
import { SourceId, SOURCES } from '../models/metrics.model';
import { KEYS, readJson, writeJson } from '../../shared/storage';

export interface Connection {
  id: SourceId;
  connectedAt: string;
}

/** Which wearables are linked. Mock of GET /api/wearables/connections. */
@Injectable({ providedIn: 'root' })
export class SourcesStore {
  readonly connections = signal<Connection[]>(readJson(KEYS.sources, []));

  /** The first linked source feeds Pimpek; extra ones are listed but not merged yet. */
  readonly primary = computed(() => {
    const first = this.connections()[0];
    return first && SOURCES.find((s) => s.id === first.id);
  });

  constructor() {
    effect(() => writeJson(KEYS.sources, this.connections()));
  }

  isConnected(id: SourceId): boolean {
    return this.connections().some((c) => c.id === id);
  }

  connect(id: SourceId): void {
    if (this.isConnected(id) || !SOURCES.find((s) => s.id === id)?.web) return;
    this.connections.update((list) => [...list, { id, connectedAt: new Date().toISOString() }]);
  }

  disconnect(id: SourceId): void {
    this.connections.update((list) => list.filter((c) => c.id !== id));
  }

  replace(list: Connection[]): void {
    this.connections.set(list);
  }
}
