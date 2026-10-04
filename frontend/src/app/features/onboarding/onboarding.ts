import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MOODS } from '../../core/models/journal.model';
import { DemoControls } from '../../core/state/demo-controls';
import { SettingsStore } from '../../core/state/settings.store';
import { Icon } from '../../shared/icon/icon';
import { PimpekAvatar } from '../pimpek/pimpek-avatar';

const STEP_COUNT = 3;
const HATCH_MS = 900;

/** One question per screen, Pimpek as the guide: hatch and name him, see how the journal works, done. */
@Component({
  selector: 'app-onboarding',
  imports: [PimpekAvatar, Icon],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Onboarding {
  protected readonly settings = inject(SettingsStore);
  private readonly demo = inject(DemoControls);
  private readonly router = inject(Router);

  protected readonly steps = Array.from({ length: STEP_COUNT }, (_, i) => i);
  protected readonly step = signal(0);
  protected readonly hatch = signal<'egg' | 'hatching' | 'hatched'>('egg');
  protected readonly moods = MOODS;

  protected crackEgg(): void {
    if (this.hatch() !== 'egg') return;
    this.hatch.set('hatching');
    setTimeout(() => this.hatch.set('hatched'), HATCH_MS);
  }

  protected rename(event: Event): void {
    this.settings.update({ petName: (event.target as HTMLInputElement).value });
  }

  protected next(): void {
    this.step.update((s) => Math.min(STEP_COUNT - 1, s + 1));
  }

  protected back(): void {
    this.step.update((s) => Math.max(0, s - 1));
  }

  protected finish(): void {
    this.settings.update({ onboarded: true });
    this.router.navigateByUrl('/');
  }

  protected startDemo(): void {
    this.demo.load('good');
    this.router.navigateByUrl('/');
  }
}
