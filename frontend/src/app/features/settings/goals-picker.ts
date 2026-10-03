import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Goals } from '../../core/models/settings.model';
import { SettingsStore } from '../../core/state/settings.store';
import { formatHours, formatSteps } from '../../shared/format';
import { Icon, IconName } from '../../shared/icon/icon';

interface GoalRow {
  key: keyof Goals;
  icon: IconName;
  label: string;
  hint: string;
  options: { value: number; label: string }[];
}

const ROWS: readonly GoalRow[] = [
  {
    key: 'sleepHours',
    icon: 'moon',
    label: 'Sen',
    hint: 'Dorosłym zaleca się co najmniej 7 h snu.',
    options: [6.5, 7, 7.5, 8, 9].map((h) => ({ value: h, label: formatHours(h) })),
  },
  {
    key: 'steps',
    icon: 'steps',
    label: 'Kroki',
    hint: 'WHO: min. 150 minut ruchu tygodniowo.',
    options: [5000, 7500, 8000, 10000, 12000].map((s) => ({ value: s, label: formatSteps(s) })),
  },
  {
    key: 'screenMaxHours',
    icon: 'phone',
    label: 'Ekran (max)',
    hint: 'Czas przed ekranem poza pracą.',
    options: [2, 3, 4, 5].map((h) => ({ value: h, label: `${h} h` })),
  },
];

/** Goals as friendly presets instead of number inputs. Shared by onboarding and settings. */
@Component({
  selector: 'app-goals-picker',
  imports: [Icon],
  template: `
    @for (row of rows; track row.key) {
      <fieldset>
        <legend><app-icon [name]="row.icon" /> {{ row.label }}</legend>
        <div class="chips">
          @for (option of row.options; track option.value) {
            <button
              type="button"
              class="chip"
              [attr.aria-pressed]="settings.goals()[row.key] === option.value"
              (click)="pick(row.key, option.value)"
            >
              {{ option.label }}
            </button>
          }
        </div>
        <p class="muted">{{ row.hint }}</p>
      </fieldset>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
    }
    fieldset {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      margin: 0;
      padding: 0;
      border: 0;
    }
    legend {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-bottom: 0.5rem;
      padding: 0;
      font-weight: 800;
    }
    .muted {
      font-size: 0.8rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalsPicker {
  protected readonly settings = inject(SettingsStore);
  protected readonly rows = ROWS;

  protected pick(key: keyof Goals, value: number): void {
    this.settings.updateGoals({ [key]: value });
  }
}
