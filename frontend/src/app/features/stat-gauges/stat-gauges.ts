import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PetStats, StatKey } from '../../core/state/pet-rules';

const GAUGES: { key: StatKey; icon: string; label: string }[] = [
  { key: 'energy', icon: '⚡', label: 'Energia (sen)' },
  { key: 'nutrition', icon: '🍎', label: 'Odżywienie' },
  { key: 'fitness', icon: '🏃', label: 'Kondycja' },
  { key: 'mood', icon: '😊', label: 'Nastrój' },
  { key: 'screen', icon: '📵', label: 'Detoks cyfrowy' },
];

@Component({
  selector: 'app-stat-gauges',
  templateUrl: './stat-gauges.html',
  styleUrl: './stat-gauges.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatGauges {
  readonly stats = input.required<PetStats>();

  protected readonly gauges = computed(() =>
    GAUGES.map((g) => {
      const value = this.stats()[g.key];
      const level = value >= 70 ? 'good' : value >= 40 ? 'ok' : 'low';
      return { ...g, value, level };
    }),
  );
}
