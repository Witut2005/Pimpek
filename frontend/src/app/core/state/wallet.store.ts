import { computed, effect, Injectable, signal } from '@angular/core';
import { ItemId, PetItem } from '../models/item.model';
import { KEYS, readJson, writeJson } from '../../shared/storage';

export interface WalletState {
  /** Leaves: earned for healthy days and quests, spent in the shop. */
  balance: number;
  owned: ItemId[];
  questDoneOn?: string;
}

@Injectable({ providedIn: 'root' })
export class WalletStore {
  readonly state = signal<WalletState>(readJson(KEYS.wallet, { balance: 0, owned: [] }));

  readonly balance = computed(() => this.state().balance);
  readonly owned = computed(() => new Set(this.state().owned));
  readonly questDoneOn = computed(() => this.state().questDoneOn);

  constructor() {
    effect(() => writeJson(KEYS.wallet, this.state()));
  }

  earn(amount: number): void {
    this.state.update((s) => ({ ...s, balance: s.balance + amount }));
  }

  buy(item: PetItem): boolean {
    const price = item.price ?? 0;
    if (!price || this.owned().has(item.id) || this.balance() < price) return false;
    this.state.update((s) => ({ ...s, balance: s.balance - price, owned: [...s.owned, item.id] }));
    return true;
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
