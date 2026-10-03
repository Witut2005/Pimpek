import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize, map, Observable, tap } from 'rxjs';
import { AvatarState, CheckInInput, DailyCheckIn } from '../models/check-in.model';
import { EquippedItems, ItemId, PetItemProgress } from '../models/item.model';
import { CheckInService } from '../services/check-in.service';
import {
  currentStreak,
  decayStats,
  idleAvatarState,
  itemProgress,
  ITEMS,
  PetStats,
  statsFor,
  wellbeingOf,
} from './pet-rules';
import { daysBetween, toDateKey } from '../../shared/date';

const EMPTY_STATS: PetStats = { energy: 0, fitness: 0, nutrition: 0, mood: 0, screen: 0 };

export interface SaveResult {
  checkIn: DailyCheckIn;
  newlyUnlocked: PetItemProgress[];
}

@Injectable({ providedIn: 'root' })
export class PetStore {
  private readonly api = inject(CheckInService);

  readonly today = signal(toDateKey(new Date()));
  /** Newest first. */
  readonly checkIns = signal<DailyCheckIn[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly equipped = signal<EquippedItems>({});

  readonly todayEntry = computed(() => this.checkIns().find((c) => c.date === this.today()));
  readonly latestEntry = computed(() => this.checkIns()[0]);

  readonly daysSinceLastEntry = computed(() => {
    const latest = this.latestEntry();
    return latest ? daysBetween(latest.date, this.today()) : Infinity;
  });

  readonly stats = computed<PetStats>(() => {
    const latest = this.latestEntry();
    return latest ? decayStats(statsFor(latest), this.daysSinceLastEntry()) : EMPTY_STATS;
  });

  readonly wellbeing = computed(() => wellbeingOf(this.stats()));

  readonly avatarState = computed<AvatarState>(() => {
    const entry = this.todayEntry();
    if (entry) return entry.companionReaction.avatarState;
    // A brand-new user (or one still loading) has nothing to be neglected about yet.
    if (!this.latestEntry()) return 'neutral';
    return idleAvatarState(this.stats(), this.daysSinceLastEntry());
  });

  readonly bubbleMessage = computed(() => {
    const entry = this.todayEntry();
    if (entry) return entry.companionReaction.message;
    if (this.latestEntry() && this.daysSinceLastEntry() >= 3) {
      return 'Długo Cię nie było... Czuję się kiepsko 🤒 Kliknij mnie i dodaj wpis, proszę!';
    }
    return 'Hej! Jak minął Ci dzień? Kliknij mnie i dodaj dzisiejszy wpis 📝';
  });

  readonly streak = computed(
    () => currentStreak(new Set(this.checkIns().map((c) => c.date)), this.today()),
  );

  readonly items = computed<PetItemProgress[]>(() =>
    ITEMS.map((item) => {
      const progress = itemProgress(item, this.checkIns());
      return { ...item, progress, unlocked: progress >= item.target };
    }),
  );

  /** Only items that are still unlocked — protects against stale equipment. */
  readonly wornItems = computed<ItemId[]>(() => {
    const unlocked = new Set(this.items().filter((i) => i.unlocked).map((i) => i.id));
    return Object.values(this.equipped()).filter((id) => unlocked.has(id));
  });

  load(): void {
    this.loading.set(true);
    this.api
      .getCheckIns()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((checkIns) => this.checkIns.set(checkIns));
  }

  save(input: CheckInInput): Observable<SaveResult> {
    const unlockedBefore = new Set(this.items().filter((i) => i.unlocked).map((i) => i.id));
    this.saving.set(true);
    return this.api.saveCheckIn(input).pipe(
      tap((saved) =>
        this.checkIns.update((list) =>
          [saved, ...list.filter((c) => c.date !== saved.date)].sort((a, b) =>
            b.date.localeCompare(a.date),
          ),
        ),
      ),
      map((checkIn) => ({
        checkIn,
        newlyUnlocked: this.items().filter((i) => i.unlocked && !unlockedBefore.has(i.id)),
      })),
      finalize(() => this.saving.set(false)),
    );
  }

  toggleItem(id: ItemId): void {
    const item = this.items().find((i) => i.id === id);
    if (!item?.unlocked) return;
    this.equipped.update((eq) => ({ ...eq, [item.slot]: eq[item.slot] === id ? undefined : id }));
  }
}
