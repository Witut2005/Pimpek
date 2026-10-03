import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AvatarState } from '../../core/models/check-in.model';
import { PetStore } from '../../core/state/pet.store';
import { addDays } from '../../shared/date';

const DAYS_SHOWN = 14;

const STATE_EMOJI: Record<AvatarState, string> = {
  happy: '😄',
  neutral: '🙂',
  sleepy: '😴',
  sad: '😢',
  sick: '🤒',
};

@Component({
  selector: 'app-history',
  imports: [DatePipe],
  templateUrl: './history.html',
  styleUrl: './history.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class History {
  private readonly store = inject(PetStore);
  protected readonly stateEmoji = STATE_EMOJI;

  protected readonly days = computed(() => {
    const byDate = new Map(this.store.checkIns().map((c) => [c.date, c]));
    return Array.from({ length: DAYS_SHOWN }, (_, i) => {
      const date = addDays(this.store.today(), -i);
      return { date, entry: byDate.get(date) };
    });
  });
}
