import { computed, effect, Injectable, signal } from '@angular/core';
import { KEYS, readJson, writeJson } from '../../shared/storage';

export interface WalletState {
  /** Leaves: earned for healthy days and quests. */
  balance: number;
  questDoneOn?: string;
}

@Injectable({ providedIn: 'root' })
export class WalletStore {
  readonly state = signal<WalletState>(readJson(KEYS.wallet, { balance: 0 }));

  readonly balance = computed(() => this.state().balance);
  readonly questDoneOn = computed(() => this.state().questDoneOn);

  constructor() {
    effect(() => writeJson(KEYS.wallet, this.state()));
  }

  earn(amount: number): void {
    this.state.update((s) => ({ ...s, balance: s.balance + amount }));
  }

  completeQuest(date: string, reward: number): boolean {
    if (this.questDoneOn() === date) return false;
    this.state.update((s) => ({ ...s, balance: s.balance + reward, questDoneOn: date }));
    return true;
  }

  replace(state: WalletState): void {
    this.state.set(state);
  }
}
