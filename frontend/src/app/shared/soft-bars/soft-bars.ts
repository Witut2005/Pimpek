import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface SoftBar {
  label: string;
  value: number | undefined;
  /** Shown on hover and read by screen readers. */
  title: string;
  today?: boolean;
}

/**
 * A chart that doesn't look like Excel: rounded bars, no grid or axis numbers, the goal as
 * a soft shaded band. Bars that meet the goal turn sage.
 */
@Component({
  selector: 'app-soft-bars',
  template: `
    <div class="chart" role="img" [attr.aria-label]="summary()">
      @if (goalPct() !== undefined) {
        <span
          class="band"
          [class.max]="goalMode() === 'max'"
          [style.--goal]="goalPct()"
          aria-hidden="true"
        >
          @if (goalLabel()) {
            <span class="band-label">{{ goalLabel() }}</span>
          }
        </span>
      }
      @for (bar of bars(); track $index) {
        <div class="col" [class.today]="bar.today" [title]="bar.title">
          <span class="track">
            @if (bar.value === undefined) {
              <span class="empty"></span>
            } @else {
              <span class="bar" [class.met]="met(bar.value)" [style.--h]="pct(bar.value)"></span>
            }
          </span>
          <span class="label">{{ bar.label }}</span>
        </div>
      }
    </div>
  `,
  styleUrl: './soft-bars.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoftBars {
  readonly bars = input.required<readonly SoftBar[]>();
  readonly max = input.required<number>();
  readonly goal = input<number>();
  readonly goalMode = input<'min' | 'max'>('min');
  readonly goalLabel = input<string>();

  protected readonly goalPct = computed(() => {
    const goal = this.goal();
    return goal === undefined ? undefined : this.pct(goal);
  });

  protected readonly summary = computed(() =>
    this.bars()
      .map((b) => b.title)
      .join(', '),
  );

  protected pct(value: number): number {
    return Math.min(100, Math.max(4, (value / this.max()) * 100));
  }

  protected met(value: number): boolean {
    const goal = this.goal();
    if (goal === undefined) return false;
    return this.goalMode() === 'min' ? value >= goal : value <= goal;
  }
}
