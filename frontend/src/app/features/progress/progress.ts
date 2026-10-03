import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DayView, PetStore } from '../../core/state/pet.store';
import { StatKey } from '../../core/state/pet-rules';
import { SettingsStore } from '../../core/state/settings.store';
import { formatHours, formatSteps, weekdayShort } from '../../shared/format';
import { Icon } from '../../shared/icon/icon';
import { SoftBar, SoftBars } from '../../shared/soft-bars/soft-bars';
import { History } from '../history/history';
import { NEEDS } from '../needs/needs';
import { PimpekAvatar } from '../pimpek/pimpek-avatar';
import { ProfileCard } from './profile-card';
import { Trainings } from './trainings';

const TREND_ORDER: readonly StatKey[] = ['energy', 'fitness', 'nutrition', 'screen', 'mood'];

const average = (values: (number | undefined)[]): number | undefined => {
  const known = values.filter((v): v is number => v !== undefined);
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : undefined;
};

/** "Compared to last week" in words, honest about which direction is good. */
function comparison(key: StatKey, now: number, before: number | undefined): string {
  if (before === undefined) return 'to pierwszy taki tydzień';
  const diff = now - before;
  switch (key) {
    case 'energy': {
      const minutes = Math.round(Math.abs(diff) * 60);
      if (minutes < 10) return 'tyle samo co tydzień wcześniej';
      const amount = minutes >= 60 ? formatHours(minutes / 60) : `${minutes} min`;
      return `o ${amount} ${diff > 0 ? 'więcej' : 'mniej'} niż tydzień wcześniej`;
    }
    case 'fitness':
      if (Math.abs(diff) < 300) return 'podobnie jak tydzień wcześniej';
      return `o ${formatSteps(Math.abs(diff))} kroków dziennie ${diff > 0 ? 'więcej' : 'mniej'}`;
    case 'screen':
      if (Math.abs(diff) < 0.25) return 'tyle samo co tydzień wcześniej';
      return diff < 0 ? 'mniej niż tydzień wcześniej, brawo' : 'więcej niż tydzień wcześniej';
    default: {
      const threshold = key === 'mood' ? 0.5 : 5;
      if (Math.abs(diff) < threshold) return 'podobnie jak tydzień wcześniej';
      return diff > 0 ? 'lepiej niż tydzień wcześniej' : 'trochę gorzej niż tydzień wcześniej';
    }
  }
}

/** Trends without spreadsheets: faces for the week, soft bars per need. */
@Component({
  selector: 'app-progress',
  imports: [PimpekAvatar, SoftBars, Icon, History, Trainings, ProfileCard],
  templateUrl: './progress.html',
  styleUrl: './progress.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Progress {
  private readonly store = inject(PetStore);
  protected readonly settings = inject(SettingsStore);

  protected readonly days = this.store.recentDays;
  protected readonly week = computed(() => this.days().slice(-7));

  protected readonly faces = computed(() =>
    this.week().map((day, i) => ({
      date: day.date,
      label: i === 6 ? 'dziś' : weekdayShort(day.date),
      state: day.state,
    })),
  );

  protected readonly weekSentence = computed(() => {
    const known = this.week().filter((d) => d.state);
    if (!known.length) return 'Ten tydzień dopiero się zaczyna. Dodaj wpis, a Pimpek go zapamięta.';
    const good = known.filter((d) => d.state === 'happy' || d.state === 'neutral').length;
    return `W tym tygodniu Pimpek był w dobrym humorze przez ${good} z ${known.length} dni.`;
  });

  protected readonly trends = computed(() => {
    const goals = this.settings.goals();
    const previous = this.days().slice(-14, -7);
    return TREND_ORDER.map((key, index) => {
      const meta = NEEDS[key];
      const bars: SoftBar[] = this.week().map((day: DayView, i) => {
        const value = meta.value(day);
        return {
          label: i === 6 ? 'dziś' : weekdayShort(day.date),
          value,
          title: `${weekdayShort(day.date)}: ${value === undefined ? 'brak danych' : meta.format(value)}`,
          today: i === 6,
        };
      });
      // Today is still in progress, so averages use complete days only.
      const now = average(this.week().slice(0, 6).map(meta.value));
      const before = average(previous.map(meta.value));
      return {
        key,
        meta,
        bars,
        open: index === 0,
        max: meta.max(goals),
        goal: meta.goal?.(goals),
        goalLabel: meta.goalLabel?.(goals),
        summary:
          now === undefined
            ? 'Za mało danych, żeby coś powiedzieć.'
            : `Średnio ${meta.format(now)}, ${comparison(key, now, before)}.`,
      };
    });
  });
}
