import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { finalize, map, Observable, tap } from 'rxjs';
import { AvatarState, CheckInInput, DailyCheckIn } from '../models/check-in.model';
import { BadgeProgress, EquippedItems, ItemId, PetItemProgress } from '../models/item.model';
import { WearableDay } from '../models/metrics.model';
import { CheckInService } from '../services/check-in.service';
import { wearableGreeting } from '../services/companion-reaction';
import { ClockStore } from './clock.store';
import {
  BADGES,
  badgeEarned,
  currentStreak,
  decayStats,
  idleAvatarState,
  itemProgress,
  ITEMS,
  leavesFor,
  measuredStats,
  PetStats,
  questFor,
  STAT_KEYS,
  StatKey,
  statsFor,
  wellbeingOf,
  withWearable,
} from './pet-rules';
import { SettingsStore } from './settings.store';
import { SourcesStore } from './sources.store';
import { SyncStore } from './sync.store';
import { WalletStore } from './wallet.store';
import { addDays, daysBetween } from '../../shared/date';
import { KEYS, readJson, writeJson } from '../../shared/storage';

const EMPTY_STATS: PetStats = { energy: 0, fitness: 0, nutrition: 0, mood: 0, screen: 0 };
const HISTORY_DAYS = 28;
/** Below this, a short night shows on Pimpek's face even before the check-in. */
const SLEEPY_ENERGY = 55;

export interface SaveResult {
  checkIn: DailyCheckIn;
  newlyUnlocked: PetItemProgress[];
  /** Leaves earned — only the first save of a day pays out. */
  leaves: number;
}

/** One calendar day as the progress views see it: manual entry and wearable merged. */
export interface DayView {
  date: string;
  entry?: DailyCheckIn;
  wearable?: WearableDay;
  state?: AvatarState;
  wellbeing?: number;
  sleepHours?: number;
  steps?: number;
  runningKm?: number;
  food?: number;
  mood?: number;
  screen?: number;
}

@Injectable({ providedIn: 'root' })
export class PetStore {
  private readonly api = inject(CheckInService);
  private readonly settings = inject(SettingsStore);
  private readonly clock = inject(ClockStore);
  private readonly sync = inject(SyncStore);
  private readonly sources = inject(SourcesStore);
  private readonly wallet = inject(WalletStore);

  readonly today = this.clock.today;
  readonly goals = this.settings.goals;
  /** Newest first. */
  readonly checkIns = signal<DailyCheckIn[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly equipped = signal<EquippedItems>(readJson(KEYS.equipped, {}));

  private readonly checkInsByDate = computed(() => new Map(this.checkIns().map((c) => [c.date, c])));
  private readonly wearableByDate = computed(() => new Map(this.sync.days().map((d) => [d.date, d])));

  readonly todayEntry = computed(() => this.checkInsByDate().get(this.today()));
  readonly todayWearable = computed(() => this.wearableByDate().get(this.today()));
  readonly latestEntry = computed(() => this.checkIns().find((c) => c.date <= this.today()));
  readonly hasAnyData = computed(() => !!this.latestEntry() || !!this.todayWearable());

  readonly daysSinceLastEntry = computed(() => {
    const latest = this.latestEntry();
    return latest ? daysBetween(latest.date, this.today()) : Infinity;
  });

  readonly stats = computed<PetStats>(() => {
    const goals = this.goals();
    const latest = this.latestEntry();
    const merged = latest && withWearable(latest, this.wearableByDate().get(latest.date));
    let stats = merged ? decayStats(statsFor(merged, goals), this.daysSinceLastEntry()) : EMPTY_STATS;
    // Fresh wearable data beats yesterday's decayed numbers for what it can measure.
    const measured = this.todayWearable();
    if (measured && !this.todayEntry()) stats = { ...stats, ...measuredStats(measured, goals) };
    return stats;
  });

  /** Needs we actually know something about — the rest show as "waiting". */
  readonly knownStats = computed<ReadonlySet<StatKey>>(() => {
    if (this.latestEntry()) return new Set(STAT_KEYS);
    if (this.todayWearable()) return new Set<StatKey>(['energy', 'fitness']);
    return new Set();
  });

  readonly wellbeing = computed(() => wellbeingOf(this.stats()));

  private readonly rawAvatarState = computed<AvatarState>(() => {
    const entry = this.todayEntry();
    if (entry) return entry.companionReaction.avatarState;
    const measured = this.todayWearable();
    if (measured && measuredStats(measured, this.goals()).energy < SLEEPY_ENERGY) return 'sleepy';
    // A brand-new user (or one still loading) has nothing to be neglected about yet.
    if (!this.latestEntry()) return 'neutral';
    return idleAvatarState(this.stats(), this.daysSinceLastEntry());
  });

  readonly avatarState = computed<AvatarState>(() => {
    const state = this.rawAvatarState();
    return this.settings.settings().gentleMode && state === 'sick' ? 'sleepy' : state;
  });

  readonly bubbleMessage = computed(() => {
    const source = this.sources.primary();
    switch (this.sync.status()) {
      case 'syncing':
        return `Zaglądam do ${source?.genitive}… sprawdzam, jak minęła noc 🔄`;
      case 'error':
        return `${source?.short} jeszcze śpi i nie mogę go dobudzić. Dotknij chmurki, spróbuję jeszcze raz.`;
      case 'offline':
        return 'Nie ma internetu, ale wszystko pamiętam 💭 Dane z zegarka pobiorę, gdy sieć wróci.';
    }
    const entry = this.todayEntry();
    if (entry) return entry.companionReaction.message;
    const longAway = !!this.latestEntry() && this.daysSinceLastEntry() >= 3;
    const measured = this.todayWearable();
    if (measured && source) return wearableGreeting(measured, source.short, this.goals(), longAway);
    if (longAway) {
      return this.settings.settings().gentleMode
        ? 'Dawno się nie widzieliśmy, cieszę się, że jesteś 💙 Opowiesz, co u Ciebie?'
        : 'Długo Cię nie było... Czuję się kiepsko 🤒 Kliknij mnie i dodaj wpis, proszę!';
    }
    if (!this.latestEntry()) return 'Cześć! Jestem tu nowy. Opowiesz mi o swoim dniu? Kliknij mnie 📝';
    return 'Hej! Jak minął Ci dzień? Kliknij mnie i dodaj dzisiejszy wpis 📝';
  });

  readonly streak = computed(() =>
    currentStreak(new Set(this.checkIns().map((c) => c.date)), this.today()),
  );

  readonly items = computed<PetItemProgress[]>(() => {
    const owned = this.wallet.owned();
    return ITEMS.map((item) => {
      if (item.kind === 'shop') {
        const has = owned.has(item.id);
        return { ...item, progress: has ? 1 : 0, unlocked: has };
      }
      const progress = itemProgress(item, this.checkIns(), this.goals());
      return { ...item, progress, unlocked: progress >= item.target };
    });
  });

  /** Only items that are still unlocked — protects against stale equipment. */
  readonly wornItems = computed<ItemId[]>(() => {
    const unlocked = new Set(this.items().filter((i) => i.unlocked).map((i) => i.id));
    return Object.values(this.equipped()).filter((id) => unlocked.has(id));
  });

  readonly badges = computed<BadgeProgress[]>(() => {
    const ctx = {
      checkIns: this.checkIns(),
      wearable: this.sync.days(),
      connected: !!this.sources.primary(),
      goals: this.goals(),
    };
    return BADGES.map((badge) => ({ ...badge, earned: badgeEarned(badge.id, ctx) }));
  });

  readonly quest = computed(() => questFor(this.stats(), this.knownStats()));

  /** Last 28 days, oldest first, ending today. */
  readonly recentDays = computed<DayView[]>(() =>
    Array.from({ length: HISTORY_DAYS }, (_, i) =>
      this.dayView(addDays(this.today(), i - (HISTORY_DAYS - 1))),
    ),
  );

  constructor() {
    effect(() => writeJson(KEYS.equipped, this.equipped()));
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getCheckIns()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((checkIns) => this.checkIns.set(checkIns));
  }

  save(input: CheckInInput): Observable<SaveResult> {
    const unlockedBefore = new Set(this.items().filter((i) => i.unlocked).map((i) => i.id));
    const firstToday = !this.checkInsByDate().has(input.date);
    this.saving.set(true);
    return this.api.saveCheckIn(input).pipe(
      tap((saved) =>
        this.checkIns.update((list) =>
          [saved, ...list.filter((c) => c.date !== saved.date)].sort((a, b) =>
            b.date.localeCompare(a.date),
          ),
        ),
      ),
      map((checkIn) => {
        const leaves = firstToday ? leavesFor(checkIn, this.goals()) : 0;
        if (leaves) this.wallet.earn(leaves);
        return {
          checkIn,
          leaves,
          newlyUnlocked: this.items().filter((i) => i.unlocked && !unlockedBefore.has(i.id)),
        };
      }),
      finalize(() => this.saving.set(false)),
    );
  }

  toggleItem(id: ItemId): void {
    const item = this.items().find((i) => i.id === id);
    if (!item?.unlocked) return;
    this.equipped.update((eq) => ({ ...eq, [item.slot]: eq[item.slot] === id ? undefined : id }));
  }

  /** Buys a shop item and puts it on straight away. */
  buy(id: ItemId): boolean {
    const item = this.items().find((i) => i.id === id);
    if (!item || !this.wallet.buy(item)) return false;
    this.equipped.update((eq) => ({ ...eq, [item.slot]: id }));
    return true;
  }

  resetEquipped(): void {
    this.equipped.set({});
  }

  private dayView(date: string): DayView {
    const entry = this.checkInsByDate().get(date);
    const wearable = this.wearableByDate().get(date);
    const goals = this.goals();
    const stats = entry
      ? statsFor(withWearable(entry, wearable), goals)
      : wearable && measuredStats(wearable, goals);
    const state: AvatarState | undefined =
      entry?.companionReaction.avatarState ??
      (stats && (stats.energy < SLEEPY_ENERGY ? 'sleepy' : 'neutral'));
    return {
      date,
      entry,
      wearable,
      state,
      wellbeing: stats && wellbeingOf(stats),
      sleepHours: wearable?.sleepHours ?? entry?.sleep.durationHours,
      steps: wearable?.steps ?? entry?.metrics.steps,
      runningKm: entry?.metrics.runningDistanceKm,
      food: entry?.food.qualityScore,
      mood: entry?.mood.score,
      screen: entry?.metrics.screenTimeHours,
    };
  }
}
