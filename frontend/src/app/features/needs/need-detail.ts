import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { PetStore } from '../../core/state/pet.store';
import { StatKey } from '../../core/state/pet-rules';
import { SourcesStore } from '../../core/state/sources.store';
import { Icon } from '../../shared/icon/icon';
import { SoftBar, SoftBars } from '../../shared/soft-bars/soft-bars';
import { weekdayShort } from '../../shared/format';
import { levelOf, NEEDS } from './needs';

/** One tap below a pebble: today's value, where it came from, the week, and one tip. */
@Component({
  selector: 'app-need-detail',
  imports: [Icon, SoftBars],
  template: `
    <div class="head">
      <span class="pebble" [class]="level()"><app-icon [name]="meta().icon" /></span>
      <div>
        <p class="muted">Dziś</p>
        <strong class="value">{{ todayText() }}</strong>
      </div>
      <span class="pill" [class.warm]="source() === 'z Twojego wpisu'">{{ source() }}</span>
    </div>

    <app-soft-bars
      [bars]="bars()"
      [max]="chart().max"
      [goal]="chart().goal"
      [goalMode]="meta().goalMode"
      [goalLabel]="chart().goalLabel"
    />

    @if (average(); as avg) {
      <p class="summary">Średnio w tym tygodniu: <strong>{{ avg }}</strong></p>
    }
    <p class="tip"><app-icon name="sparkle" /> {{ meta().tip }}</p>

    <button type="button" class="btn primary edit" (click)="edit.emit()">
      <app-icon name="pencil" />
      {{ store.todayEntry() ? 'Zmień: ' + meta().label.toLowerCase() : 'Dodaj dzisiejszy wpis' }}
    </button>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      > div {
        flex: 1;
      }
    }
    .pebble {
      display: grid;
      place-items: center;
      width: 3.2rem;
      height: 3rem;
      border-radius: 48% 52% 45% 55% / 56% 46% 54% 44%;
      background: var(--sage-200);
      color: var(--sage-700);
      font-size: 1.4rem;
      &.ok {
        background: var(--honey-200);
        color: var(--honey-700);
      }
      &.low {
        background: var(--rose-200);
        color: var(--terracotta-700);
      }
    }
    .value {
      font-size: 1.35rem;
    }
    .summary {
      margin: 0;
      color: var(--text-muted);
    }
    .tip {
      display: flex;
      gap: 0.5rem;
      margin: 0;
      padding: 0.85rem 1rem;
      border-radius: 1.3rem;
      background: var(--peach-100);
      color: var(--terracotta-700);
      font-weight: 600;
      app-icon {
        margin-top: 0.1rem;
      }
    }
    .edit {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NeedDetail {
  protected readonly store = inject(PetStore);
  private readonly sources = inject(SourcesStore);

  readonly stat = input.required<StatKey>();
  readonly edit = output<void>();

  protected readonly meta = computed(() => NEEDS[this.stat()]);
  protected readonly chart = computed(() => {
    const meta = this.meta();
    const goals = this.store.goals();
    return { max: meta.max(goals), goal: meta.goal?.(goals), goalLabel: meta.goalLabel?.(goals) };
  });
  protected readonly week = computed(() => this.store.recentDays().slice(-7));
  protected readonly level = computed(() => levelOf(this.store.stats()[this.stat()]));

  protected readonly todayValue = computed(() => this.meta().value(this.week()[6]));
  protected readonly todayText = computed(() => {
    const value = this.todayValue();
    return value === undefined ? 'jeszcze nie wiem' : this.meta().format(value);
  });

  protected readonly source = computed(() => {
    const today = this.week()[6];
    const measured = this.stat() === 'energy' || this.stat() === 'fitness';
    if (measured && today.wearable) return `z ${this.sources.primary()?.genitive ?? 'zegarka'}`;
    if (today.entry) return 'z Twojego wpisu';
    return 'brak danych';
  });

  protected readonly bars = computed<SoftBar[]>(() =>
    this.week().map((day, i) => {
      const value = this.meta().value(day);
      return {
        label: i === 6 ? 'dziś' : weekdayShort(day.date),
        value,
        title: `${weekdayShort(day.date)}: ${value === undefined ? 'brak danych' : this.meta().format(value)}`,
        today: i === 6,
      };
    }),
  );

  protected readonly average = computed(() => {
    const values = this.week()
      .map((d) => this.meta().value(d))
      .filter((v): v is number => v !== undefined);
    if (!values.length) return undefined;
    return this.meta().format(values.reduce((a, b) => a + b, 0) / values.length);
  });
}
