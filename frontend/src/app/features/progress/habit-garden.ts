import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DayView } from '../../core/state/pet.store';
import { weekdayShort } from '../../shared/format';

type Plant = 'soil' | 'seed' | 'sprout' | 'flower';

/** Four weeks as a garden bed: the better the day, the lusher its plant. No numbers at all. */
@Component({
  selector: 'app-habit-garden',
  template: `
    <ol class="bed" aria-label="Ogródek nawyków z ostatnich 4 tygodni">
      @for (cell of cells(); track cell.date) {
        <li [class.today]="cell.today" [title]="cell.title">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <ellipse class="soil" cx="16" cy="27" rx="10" ry="3" />
            @if (cell.plant !== 'soil') {
              <path class="stem" [attr.d]="cell.plant === 'seed' ? 'M16 27v-5' : 'M16 27V13'" />
              <path class="leaf" d="M16 22c-4 0-6-2-6.5-5 4 0 6 2 6.5 5Z" />
            }
            @if (cell.plant === 'sprout' || cell.plant === 'flower') {
              <path class="leaf" d="M16 18c3.5 0 5.5-2 6-5-3.5 0-5.5 2-6 5Z" />
            }
            @if (cell.plant === 'flower') {
              <g class="petals">
                <circle cx="16" cy="6.5" r="3.2" />
                <circle cx="20" cy="10" r="3.2" />
                <circle cx="16" cy="13.5" r="3.2" />
                <circle cx="12" cy="10" r="3.2" />
              </g>
              <circle class="heart" cx="16" cy="10" r="2.4" />
            }
          </svg>
          <span class="sr-only">{{ cell.title }}</span>
        </li>
      }
    </ol>
    <p class="muted">Im lepszy dzień, tym bujniejsza roślinka.</p>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .bed {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.25rem;
      margin: 0;
      padding: 0.6rem 0.5rem 0.3rem;
      border-radius: 1.4rem;
      background: var(--sand-200);
      box-shadow: var(--shadow-pressed);
      list-style: none;
    }
    li {
      display: grid;
      place-items: center;
      aspect-ratio: 1;
      border-radius: 50%;
    }
    li.today {
      background: rgb(255 250 243 / 0.7);
    }
    svg {
      width: 100%;
      max-width: 2.6rem;
    }
    .soil {
      fill: var(--sand-300);
    }
    .stem {
      fill: none;
      stroke: var(--sage-700);
      stroke-width: 1.8;
      stroke-linecap: round;
    }
    .leaf {
      fill: var(--sage-400);
    }
    .petals {
      fill: var(--peach-300);
    }
    .heart {
      fill: var(--honey-400);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitGarden {
  readonly days = input.required<readonly DayView[]>();

  protected readonly cells = computed(() => {
    const days = this.days();
    return days.map((day, i) => {
      const w = day.wellbeing;
      const plant: Plant = w === undefined ? 'soil' : w < 40 ? 'seed' : w < 70 ? 'sprout' : 'flower';
      const words: Record<Plant, string> = {
        soil: 'brak danych',
        seed: 'trudny dzień',
        sprout: 'niezły dzień',
        flower: 'świetny dzień',
      };
      return {
        date: day.date,
        plant,
        today: i === days.length - 1,
        title: `${weekdayShort(day.date)} ${day.date.slice(8)}.${day.date.slice(5, 7)}: ${words[plant]}`,
      };
    });
  });
}
