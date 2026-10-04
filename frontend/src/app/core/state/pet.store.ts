import { computed, inject, Injectable, signal } from '@angular/core';
import { AvatarState } from '../models/check-in.model';
import { MoodLevel } from '../models/journal.model';
import { linesFor, moodSituation, pickRandom } from '../models/speech.model';
import { JournalStore } from './journal.store';
import { SettingsStore } from './settings.store';
import { avatarStateFor, daysTogether } from './pet-rules';
import { toDateKey } from '../../shared/date';

/** How long Pimpek wears a freshly picked mood before settling back to idle. */
const MOOD_SHOW_MS = 5000;

/** Pimpek's side of the journal: how he looks and what he says. */
@Injectable({ providedIn: 'root' })
export class PetStore {
  private readonly journal = inject(JournalStore);
  private readonly settings = inject(SettingsStore);

  readonly today = signal(toDateKey(new Date())).asReadonly();

  readonly todayEntry = computed(() => this.journal.byDate().get(this.today()));
  /** Newest entry up to today. */
  readonly latestEntry = computed(() => this.journal.entries().find((e) => e.date <= this.today()));
  readonly hasAnyData = computed(() => !!this.latestEntry());

  private readonly shownMood = signal<MoodLevel | null>(null);
  private shownMoodTimer?: ReturnType<typeof setTimeout>;

  /** Shows a just-picked mood for a moment, otherwise he idles calmly — skipping days never hurts him. */
  readonly avatarState = computed<AvatarState>(() => {
    const mood = this.shownMood();
    return mood ? avatarStateFor(mood) : 'neutral';
  });

  /** Drawn at random from the user's lines (or the built-in ones), again only when the entry or the lines change. */
  readonly bubbleMessage = computed(() => {
    const speech = this.settings.speech();
    const now = this.todayEntry();
    if (now) return pickRandom(linesFor(speech, moodSituation(now.mood)));
    if (!this.latestEntry()) return 'Cześć! Jestem tu nowy. Powiesz mi, jak się czujesz? Kliknij mnie 📝';
    return pickRandom(linesFor(speech, 'greeting'));
  });

  /** Wears the picked mood for a few seconds, then goes back to idle. */
  showMood(mood: MoodLevel): void {
    clearTimeout(this.shownMoodTimer);
    this.shownMood.set(mood);
    this.shownMoodTimer = setTimeout(() => this.shownMood.set(null), MOOD_SHOW_MS);
  }

  readonly daysTogether = computed(() => daysTogether(new Set(this.journal.byDate().keys()), this.today()));
}
