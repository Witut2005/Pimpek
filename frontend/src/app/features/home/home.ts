import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { PetItemProgress } from '../../core/models/item.model';
import { PetStore, SaveResult } from '../../core/state/pet.store';
import { StatKey } from '../../core/state/pet-rules';
import { SettingsStore } from '../../core/state/settings.store';
import { SyncStore } from '../../core/state/sync.store';
import { Icon } from '../../shared/icon/icon';
import { Sheet } from '../../shared/sheet/sheet';
import { CheckInDialog } from '../check-in-dialog/check-in-dialog';
import { NeedDetail } from '../needs/need-detail';
import { NEEDS } from '../needs/needs';
import { Pimpek } from '../pimpek/pimpek';
import { Progress } from '../progress/progress';
import { SettingsPanel } from '../settings/settings-panel';
import { StatGauges } from '../stat-gauges/stat-gauges';
import { Wardrobe } from '../wardrobe/wardrobe';
import { DailyQuest } from './daily-quest';
import { SyncBadge } from './sync-badge';

const CELEBRATION_MS = 1800;
const TOAST_MS = 6000;
const LEAVES_MS = 2200;
/** Wearable data younger than this isn't re-fetched when the room opens. */
const FRESH_MS = 60_000;

function greetingFor(hour: number): string {
  if (hour < 5 || hour >= 22) return 'Późno już, czas na sen';
  if (hour < 12) return 'Dzień dobry';
  if (hour < 18) return 'Hej, miło Cię widzieć';
  return 'Dobry wieczór';
}

/** Pimpek's room — the only full screen. Everything else slides up as a sheet. */
@Component({
  selector: 'app-home',
  imports: [
    Pimpek,
    StatGauges,
    CheckInDialog,
    Sheet,
    Wardrobe,
    Progress,
    SettingsPanel,
    NeedDetail,
    DailyQuest,
    SyncBadge,
    Icon,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements OnInit {
  protected readonly store = inject(PetStore);
  protected readonly settings = inject(SettingsStore);
  private readonly sync = inject(SyncStore);
  private readonly router = inject(Router);
  private readonly checkInDialog = viewChild.required(CheckInDialog);
  private readonly settingsSheet = viewChild.required<Sheet>('settingsSheet');
  private readonly needSheet = viewChild.required<Sheet>('needSheet');

  /** `?panel=ustawienia` reopens settings after coming back from a provider's login page. */
  readonly panel = input<string>();

  protected readonly greeting = greetingFor(new Date().getHours());
  protected readonly celebrating = signal(false);
  protected readonly unlockQueue = signal<PetItemProgress[]>([]);
  protected readonly unlockedToast = computed(() => this.unlockQueue()[0]);
  protected readonly leavesEarned = signal(0);
  protected readonly askReminders = signal(false);
  protected readonly selectedNeed = signal<StatKey>('energy');
  protected readonly needTitle = computed(() => NEEDS[this.selectedNeed()].label);

  private toastTimer?: ReturnType<typeof setTimeout>;
  private leavesTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    afterNextRender(() => {
      if (this.panel() !== 'ustawienia') return;
      this.settingsSheet().open();
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
    });
  }

  ngOnInit(): void {
    this.store.load();
    const syncedAt = this.sync.syncedAt();
    if (!syncedAt || Date.now() - new Date(syncedAt).getTime() > FRESH_MS) this.sync.sync();
  }

  protected openCheckIn(): void {
    this.checkInDialog().open(this.store.todayEntry());
  }

  /** From a need's detail sheet straight to editing just that need. */
  protected editNeed(): void {
    this.needSheet().close();
    this.checkInDialog().open(this.store.todayEntry(), this.selectedNeed());
  }

  protected openSettings(): void {
    this.settingsSheet().open();
  }

  protected openNeed(key: StatKey): void {
    this.selectedNeed.set(key);
    this.needSheet().open();
  }

  protected onSaved({ newlyUnlocked, leaves }: SaveResult): void {
    this.celebrate();
    if (leaves) this.showLeaves(leaves);
    if (newlyUnlocked.length) {
      this.unlockQueue.set(newlyUnlocked);
      this.scheduleNextToast();
    }
    // Ask about reminders only once Pimpek has proven useful, never on the first screen.
    if (!this.settings.settings().reminders.asked) setTimeout(() => this.askReminders.set(true), 2500);
  }

  protected onQuestDone(reward: number): void {
    this.celebrate();
    this.showLeaves(reward);
  }

  protected wearUnlocked(item: PetItemProgress): void {
    if (!this.store.wornItems().includes(item.id)) this.store.toggleItem(item.id);
    this.nextToast();
  }

  protected nextToast(): void {
    this.unlockQueue.update((queue) => queue.slice(1));
    if (this.unlockQueue().length) this.scheduleNextToast();
  }

  protected answerReminders(enabled: boolean): void {
    this.settings.updateReminders({ enabled, asked: true });
    this.askReminders.set(false);
  }

  private scheduleNextToast(): void {
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.nextToast(), TOAST_MS);
  }

  private celebrate(): void {
    this.celebrating.set(true);
    setTimeout(() => this.celebrating.set(false), CELEBRATION_MS);
  }

  private showLeaves(amount: number): void {
    clearTimeout(this.leavesTimer);
    this.leavesEarned.set(amount);
    this.leavesTimer = setTimeout(() => this.leavesEarned.set(0), LEAVES_MS);
  }
}
