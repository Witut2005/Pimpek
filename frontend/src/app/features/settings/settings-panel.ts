import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SCENARIOS } from '../../core/mocks/scenarios';
import { SOURCES } from '../../core/models/metrics.model';
import { PET_COLORS, PetColor } from '../../core/models/settings.model';
import { DemoControls } from '../../core/state/demo-controls';
import { SettingsStore } from '../../core/state/settings.store';
import { Icon } from '../../shared/icon/icon';
import { KEYS, readJson } from '../../shared/storage';
import { GoalsPicker } from './goals-picker';
import { SourceCard } from './source-card';

@Component({
  selector: 'app-settings-panel',
  imports: [Icon, GoalsPicker, SourceCard],
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPanel {
  protected readonly settings = inject(SettingsStore);
  protected readonly demo = inject(DemoControls);

  protected readonly sources = SOURCES;
  protected readonly scenarios = SCENARIOS;
  protected readonly colors = Object.entries(PET_COLORS) as [PetColor, { label: string; hex: string }][];
  protected readonly confirmDelete = signal(false);

  protected rename(event: Event): void {
    this.settings.update({ petName: (event.target as HTMLInputElement).value });
  }

  protected setTime(key: 'checkInTime' | 'bedtime', event: Event): void {
    this.settings.updateReminders({ [key]: (event.target as HTMLInputElement).value });
  }

  /** RODO: the user can take everything we keep about them. */
  protected exportData(): void {
    const data = Object.fromEntries(Object.entries(KEYS).map(([name, key]) => [name, readJson(key, null)]));
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'pimpek-moje-dane.json' });
    link.click();
    URL.revokeObjectURL(url);
  }
}
