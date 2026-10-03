import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ItemId, PetItemProgress } from '../../core/models/item.model';
import { PetStore } from '../../core/state/pet.store';
import { SettingsStore } from '../../core/state/settings.store';
import { WalletStore } from '../../core/state/wallet.store';
import { Icon } from '../../shared/icon/icon';
import { PimpekAvatar } from '../pimpek/pimpek-avatar';

type Tab = 'items' | 'shop' | 'badges';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'items', label: 'Moje rzeczy' },
  { id: 'shop', label: 'Sklepik' },
  { id: 'badges', label: 'Naklejki' },
];

@Component({
  selector: 'app-wardrobe',
  imports: [DecimalPipe, Icon, PimpekAvatar],
  templateUrl: './wardrobe.html',
  styleUrl: './wardrobe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Wardrobe {
  protected readonly store = inject(PetStore);
  protected readonly settings = inject(SettingsStore);
  protected readonly wallet = inject(WalletStore);

  protected readonly tabs = TABS;
  protected readonly tab = signal<Tab>('items');
  /** Brief "Kupione!" feedback on the card that was just bought. */
  protected readonly justBought = signal<ItemId | undefined>(undefined);

  /** Rewards plus anything bought; locked rewards stay visible as goals. */
  protected readonly myItems = computed(() =>
    this.store.items().filter((i) => i.kind === 'reward' || i.unlocked),
  );
  protected readonly shopItems = computed(() => this.store.items().filter((i) => i.kind === 'shop'));
  protected readonly earnedCount = computed(() => this.store.badges().filter((b) => b.earned).length);

  protected missing(item: PetItemProgress): number {
    return Math.max(0, (item.price ?? 0) - this.wallet.balance());
  }

  protected buy(item: PetItemProgress): void {
    if (this.store.buy(item.id)) {
      this.justBought.set(item.id);
      setTimeout(() => this.justBought.set(undefined), 1600);
    }
  }
}
