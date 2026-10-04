import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { PetStore } from '../../core/state/pet.store';
import { QuestStore } from '../../core/state/quest.store';
import { Icon } from '../../shared/icon/icon';

/** One small, doable thing a day — always aimed at Pimpek's weakest need. Never a list. */
@Component({
  selector: 'app-daily-quest',
  imports: [Icon],
  template: `
    <section class="quest" [class.done]="done()" aria-label="Dzisiejsza misja">
      <span class="badge"><app-icon [name]="quest().icon" /></span>
      <div class="text">
        <small>Misja na dziś</small>
        <strong>{{ quest().text }}</strong>
      </div>
      @if (done()) {
        <span class="pill"><app-icon name="check" /> Zrobione</span>
      } @else {
        <button type="button" class="btn soft small" (click)="complete()">
          <app-icon name="check" /> Gotowe
        </button>
      }
    </section>
  `,
  styles: `
    .quest {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 0.65rem 0.6rem 0.7rem;
      border-radius: 1.5rem 1.8rem 1.4rem 1.7rem;
      background: rgb(255 250 243 / 0.82);
      box-shadow: var(--shadow-clay);
      transition: opacity 0.4s ease;
    }
    .done {
      opacity: 0.75;
    }
    .badge {
      display: grid;
      place-items: center;
      width: 2.4rem;
      height: 2.4rem;
      border-radius: 45% 55% 50% 50% / 55% 45% 55% 45%;
      background: var(--peach-100);
      color: var(--terracotta-600);
      font-size: 1.1rem;
    }
    .text {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      line-height: 1.25;
    }
    small {
      color: var(--text-muted);
      font-size: 0.75rem;
      font-weight: 700;
    }
    strong {
      font-size: 0.95rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailyQuest {
  private readonly store = inject(PetStore);
  private readonly questStore = inject(QuestStore);

  readonly completed = output<void>();

  protected readonly quest = this.store.quest;
  protected readonly done = computed(() => this.questStore.doneOn() === this.store.today());

  protected complete(): void {
    if (this.questStore.complete(this.store.today())) this.completed.emit();
  }
}
