import { effect, Injectable, signal } from '@angular/core';
import { KEYS, readJson, writeJson } from '../../shared/storage';

/** Remembers the day the daily quest was last ticked off. */
@Injectable({ providedIn: 'root' })
export class QuestStore {
  readonly doneOn = signal<string | undefined>(readJson<string | null>(KEYS.quest, null) ?? undefined);

  constructor() {
    effect(() => writeJson(KEYS.quest, this.doneOn() ?? null));
  }

  /** False when it was already done that day. */
  complete(date: string): boolean {
    if (this.doneOn() === date) return false;
    this.doneOn.set(date);
    return true;
  }

  reset(): void {
    this.doneOn.set(undefined);
  }
}
