import { computed, Injectable, signal } from '@angular/core';
import { addDays, toDateKey } from '../../shared/date';
import { KEYS, readJson, writeJson } from '../../shared/storage';

/** "Today", with a demo-only fast-forward so the jury can see a new day (and decay) instantly. */
@Injectable({ providedIn: 'root' })
export class ClockStore {
  readonly offsetDays = signal(readJson<number>(KEYS.clock, 0));
  readonly today = computed(() => addDays(toDateKey(new Date()), this.offsetDays()));

  advance(days = 1): void {
    this.offsetDays.update((d) => d + days);
    writeJson(KEYS.clock, this.offsetDays());
  }

  reset(): void {
    this.offsetDays.set(0);
    writeJson(KEYS.clock, 0);
  }
}
