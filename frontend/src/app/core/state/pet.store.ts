import { computed, inject, Injectable } from '@angular/core';
import { AvatarState } from '../models/check-in.model';
import { reactionTo } from '../services/companion-reaction';
import { ClockStore } from './clock.store';
import { JournalStore } from './journal.store';
import { avatarStateFor, daysTogether } from './pet-rules';

/** Pimpek's side of the journal: how he looks and what he says. */
@Injectable({ providedIn: 'root' })
export class PetStore {
  private readonly journal = inject(JournalStore);
  private readonly clock = inject(ClockStore);

  readonly today = this.clock.today;

  readonly todayEntry = computed(() => this.journal.byDate().get(this.today()));
  /** Newest entry up to today (a fast-forwarded demo day can be behind the real clock). */
  readonly latestEntry = computed(() => this.journal.entries().find((e) => e.date <= this.today()));
  readonly hasAnyData = computed(() => !!this.latestEntry());

  /** Mirrors today's mood; with no entry yet he's simply calm — skipping days never hurts him. */
  readonly avatarState = computed<AvatarState>(() => {
    const now = this.todayEntry();
    return now ? avatarStateFor(now.mood) : 'neutral';
  });

  readonly bubbleMessage = computed(() => {
    const now = this.todayEntry();
    if (now) return reactionTo(now.mood);
    if (!this.latestEntry()) return 'Cześć! Jestem tu nowy. Powiesz mi, jak się czujesz? Kliknij mnie 📝';
    return 'Hej, miło Cię widzieć 💙 Jeśli masz ochotę, kliknij mnie i opowiedz, jak się czujesz.';
  });

  readonly daysTogether = computed(() => daysTogether(new Set(this.journal.byDate().keys()), this.today()));
}
