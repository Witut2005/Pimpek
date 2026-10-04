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
import { PetStore } from '../../core/state/pet.store';
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
import { DailyQuest } from './daily-quest';
import { SyncBadge } from './sync-badge';

const CELEBRATION_MS = 1800;
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
  protected readonly askReminders = signal(false);
  protected readonly selectedNeed = signal<StatKey>('energy');
  protected readonly needTitle = computed(() => NEEDS[this.selectedNeed()].label);

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

  protected onSaved(): void {
    this.celebrate();
    // Ask about reminders only once Pimpek has proven useful, never on the first screen.
    if (!this.settings.settings().reminders.asked) setTimeout(() => this.askReminders.set(true), 2500);
  }

  protected answerReminders(enabled: boolean): void {
    this.settings.updateReminders({ enabled, asked: true });
    this.askReminders.set(false);
  }

  protected celebrate(): void {
    this.celebrating.set(true);
    setTimeout(() => this.celebrating.set(false), CELEBRATION_MS);
  }
}
