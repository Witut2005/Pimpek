import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PetStats, STAT_KEYS, StatKey } from '../../core/state/pet-rules';
import { Icon } from '../../shared/icon/icon';
import { levelOf, NEEDS } from '../needs/needs';

/** How Pimpek feels, in words. Numbers live one tap deeper, in the need's detail sheet. */
@Component({
  selector: 'app-stat-gauges',
  imports: [Icon],
  templateUrl: './stat-gauges.html',
  styleUrl: './stat-gauges.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatGauges {
  readonly stats = input.required<PetStats>();
  /** Needs without any data yet show as "waiting" instead of a scary low. */
  readonly known = input<ReadonlySet<StatKey>>(new Set(STAT_KEYS));
  readonly select = output<StatKey>();

  protected readonly gauges = computed(() =>
    STAT_KEYS.map((key) => {
      const meta = NEEDS[key];
      const value = this.stats()[key];
      const known = this.known().has(key);
      const level = known ? levelOf(value) : 'unknown';
      return { key, value, level, icon: meta.icon, label: meta.label, word: known ? meta.words[levelOf(value)] : 'czeka na wpis' };
    }),
  );
}
