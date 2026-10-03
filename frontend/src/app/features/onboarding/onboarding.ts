import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SOURCES } from '../../core/models/metrics.model';
import { DemoControls } from '../../core/state/demo-controls';
import { SettingsStore } from '../../core/state/settings.store';
import { SourcesStore } from '../../core/state/sources.store';
import { SyncStore } from '../../core/state/sync.store';
import { Icon, IconName } from '../../shared/icon/icon';
import { PimpekAvatar } from '../pimpek/pimpek-avatar';
import { GoalsPicker } from '../settings/goals-picker';
import { SourceCard } from '../settings/source-card';

const STEP_COUNT = 5;
const HATCH_MS = 900;
const MAX_FOCUS = 3;

const FOCUS: readonly { id: string; icon: IconName; label: string }[] = [
  { id: 'energy', icon: 'moon', label: 'Lepszy sen' },
  { id: 'fitness', icon: 'steps', label: 'Więcej ruchu' },
  { id: 'nutrition', icon: 'apple', label: 'Zdrowsze jedzenie' },
  { id: 'screen', icon: 'phone', label: 'Mniej ekranu' },
  { id: 'mood', icon: 'heart', label: 'Więcej ludzi' },
];

/** One question per screen, Pimpek as the guide. Connecting Garmin is required; demo mode skips it. */
@Component({
  selector: 'app-onboarding',
  imports: [PimpekAvatar, Icon, GoalsPicker, SourceCard],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Onboarding implements OnInit {
  protected readonly settings = inject(SettingsStore);
  private readonly sources = inject(SourcesStore);
  private readonly sync = inject(SyncStore);
  private readonly demo = inject(DemoControls);
  private readonly router = inject(Router);

  /** `?krok=3` — coming back from a provider's login page lands on the same step. */
  readonly krok = input<string>();

  protected readonly steps = Array.from({ length: STEP_COUNT }, (_, i) => i);
  protected readonly step = signal(0);
  protected readonly hatch = signal<'egg' | 'hatching' | 'hatched'>('egg');
  protected readonly focusOptions = FOCUS;
  protected readonly allSources = SOURCES;
  protected readonly anyConnected = computed(() => !!this.sources.primary());
  /** The watch step can't be skipped: Garmin data is what spares the user typing. */
  protected readonly needsWatch = computed(() => this.step() === 3 && !this.anyConnected());

  ngOnInit(): void {
    const step = Number(this.krok());
    if (step > 0 && step < STEP_COUNT) {
      this.hatch.set('hatched');
      this.step.set(step);
    }
  }

  protected crackEgg(): void {
    if (this.hatch() !== 'egg') return;
    this.hatch.set('hatching');
    setTimeout(() => this.hatch.set('hatched'), HATCH_MS);
  }

  protected rename(event: Event): void {
    this.settings.update({ petName: (event.target as HTMLInputElement).value });
  }

  protected isFocused(id: string): boolean {
    return this.settings.settings().focus.includes(id);
  }

  protected toggleFocus(id: string): void {
    const focus = this.settings.settings().focus;
    if (focus.includes(id)) this.settings.update({ focus: focus.filter((f) => f !== id) });
    else if (focus.length < MAX_FOCUS) this.settings.update({ focus: [...focus, id] });
  }

  protected next(): void {
    if (this.needsWatch()) return;
    this.step.update((s) => Math.min(STEP_COUNT - 1, s + 1));
  }

  protected back(): void {
    this.step.update((s) => Math.max(0, s - 1));
  }

  protected finish(): void {
    this.settings.update({ onboarded: true });
    if (this.anyConnected()) this.sync.sync();
    this.router.navigateByUrl('/');
  }

  protected startDemo(): void {
    this.demo.load('good');
    this.router.navigateByUrl('/');
  }
}
