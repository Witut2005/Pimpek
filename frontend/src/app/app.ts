import { ChangeDetectionStrategy, Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { PetItemProgress } from './core/models/item.model';
import { PetStore, SaveResult } from './core/state/pet.store';
import { CheckInDialog } from './features/check-in-dialog/check-in-dialog';
import { History } from './features/history/history';
import { Pimpek } from './features/pimpek/pimpek';
import { StatGauges } from './features/stat-gauges/stat-gauges';
import { Wardrobe } from './features/wardrobe/wardrobe';
import { Sheet } from './shared/sheet/sheet';

const CELEBRATION_MS = 1800;
const TOAST_MS = 6000;

@Component({
  selector: 'app-root',
  imports: [Pimpek, StatGauges, CheckInDialog, Sheet, Wardrobe, History],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  protected readonly store = inject(PetStore);
  private readonly checkInDialog = viewChild.required(CheckInDialog);

  protected readonly celebrating = signal(false);
  protected readonly unlockedToast = signal<PetItemProgress | undefined>(undefined);
  private toastTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.store.load();
  }

  protected openCheckIn(): void {
    this.checkInDialog().open(this.store.todayEntry());
  }

  protected onSaved({ newlyUnlocked }: SaveResult): void {
    this.celebrating.set(true);
    setTimeout(() => this.celebrating.set(false), CELEBRATION_MS);

    if (newlyUnlocked.length) {
      clearTimeout(this.toastTimer);
      this.unlockedToast.set(newlyUnlocked[0]);
      this.toastTimer = setTimeout(() => this.unlockedToast.set(undefined), TOAST_MS);
    }
  }

  protected wearUnlocked(item: PetItemProgress): void {
    if (!this.store.wornItems().includes(item.id)) this.store.toggleItem(item.id);
    this.unlockedToast.set(undefined);
  }
}
