import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, Subscription } from 'rxjs';
import { CheckInInput, DailyCheckIn } from '../../core/models/check-in.model';
import { FoodEntry, FoodRating, MealDay } from '../../core/models/meals.model';
import { WearableApi } from '../../core/services/wearable-api';
import { moodLabel, StatKey } from '../../core/state/pet-rules';
import { ClockStore } from '../../core/state/clock.store';
import { estimateFoodRating, mergeDiary, ratingRequest } from '../../core/state/food-entries';
import { PetStore, SaveResult } from '../../core/state/pet.store';
import { SettingsStore } from '../../core/state/settings.store';
import { SourcesStore } from '../../core/state/sources.store';
import { formatDayMonth, formatHours, formatKm, formatSteps } from '../../shared/format';
import { Icon, IconName } from '../../shared/icon/icon';
import { NEEDS } from '../needs/needs';
import { FoodStep } from './food-step';

const STEPS: readonly { title: string; icon: IconName }[] = [
  { title: 'Nastrój', icon: 'smile' },
  { title: 'Sen', icon: 'moon' },
  { title: 'Jedzenie', icon: 'apple' },
  { title: 'Ruch i ekran', icon: 'steps' },
  { title: 'Ludzie', icon: 'heart' },
];

/** Which step answers each need — a need's sheet opens the dialog right there. */
const STEP_OF: Record<StatKey, number> = { mood: 0, energy: 1, nutrition: 2, fitness: 3, screen: 3 };

/** Garmin calls 70+ a "good" night — a fair default for "do you feel rested?". */
const RESTED_SLEEP_SCORE = 70;

const MOOD_EMOJI = ['😫', '😣', '😞', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩'];

/** Nothing logged: Pimpek can't tell, so the need sits in the middle instead of starving. */
const NOTHING_LOGGED_SCORE = 50;

@Component({
  selector: 'app-check-in-dialog',
  imports: [ReactiveFormsModule, Icon, FoodStep],
  templateUrl: './check-in-dialog.html',
  styleUrl: './check-in-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckInDialog {
  private readonly store = inject(PetStore);
  private readonly sources = inject(SourcesStore);
  private readonly settings = inject(SettingsStore);
  private readonly api = inject(WearableApi);
  private readonly clock = inject(ClockStore);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private mealsRequest?: Subscription;
  private ratingRequest?: Subscription;
  /** The day being filled in. */
  private mealsDate = '';
  /** The entry being edited, if any. */
  private existing?: DailyCheckIn;

  readonly saved = output<SaveResult>();

  protected readonly steps = STEPS;
  protected readonly goals = this.store.goals;
  /** Wearable data only pre-fills the form — what gets saved is what the user sets by hand. */
  protected readonly measured = this.store.todayWearable;
  /** Rounded like the km field, so "is it still the watch's value?" compares like with like. */
  protected readonly measuredKm = computed(() => {
    const km = this.measured()?.runningKm;
    return km === undefined ? undefined : Math.round(km * 10) / 10;
  });
  protected readonly sourceName = computed(() => this.sources.primary()?.genitive ?? 'zegarka');
  /** With a food diary, the food step starts from what was logged there. */
  protected readonly diet = this.sources.diet;
  protected readonly mealDay = signal<MealDay | undefined>(undefined);
  protected readonly mealsStatus = signal<'idle' | 'loading' | 'error'>('idle');
  /** What was eaten, as the user confirms it: diary items, edited or not, and typed-in food. */
  protected readonly foodEntries = signal<FoodEntry[]>([]);
  protected readonly rating = signal<FoodRating | undefined>(undefined);
  /** The list `rating` was given for. Lists are replaced, never mutated, so identity tells. */
  private readonly ratedFor = signal<FoodEntry[] | undefined>(undefined);
  /** False once the list changed by hand: the rating then describes a different day. */
  protected readonly ratingFresh = computed(() => !!this.rating() && this.ratedFor() === this.foodEntries());
  protected readonly ratingStatus = signal<'idle' | 'loading'>('idle');
  /** Typed-in food is rated on request; so is a retry after the AI was unavailable. */
  protected readonly canAskForRating = computed(
    () =>
      this.foodEntries().length > 0 &&
      this.ratingStatus() === 'idle' &&
      (!this.ratingFresh() || this.rating()?.source === 'estimate'),
  );
  protected readonly askLabel = computed(() =>
    this.settings.petName() === 'Pimpek' ? 'Poproś Pimpka o ocenę' : 'Poproś o ocenę',
  );
  protected readonly petName = this.settings.petName;
  /** A fast-forwarded demo day asks the real diary about a day that hasn't happened yet. */
  protected readonly demoShifted = computed(() => this.clock.offsetDays() !== 0);
  protected readonly formatDayMonth = formatDayMonth;
  protected readonly submitLabel = computed(() => {
    if (this.isEdit()) return 'Zapisz zmiany';
    return this.settings.petName() === 'Pimpek' ? 'Nakarm Pimpka' : 'Zapisz dzień';
  });
  protected readonly formatHours = formatHours;
  protected readonly formatSteps = formatSteps;
  protected readonly formatKm = formatKm;
  protected readonly step = signal(0);
  protected readonly isEdit = signal(false);
  /** Set when fixing one need in an existing entry: only that question, saved in one tap. */
  protected readonly focus = signal<StatKey | null>(null);
  protected readonly saving = this.store.saving;
  protected readonly isLastStep = computed(() => !!this.focus() || this.step() === STEPS.length - 1);
  protected readonly stepTitle = computed(() => {
    const focus = this.focus();
    return focus ? NEEDS[focus].label : STEPS[this.step()].title;
  });
  protected readonly showRunning = computed(() => this.focus() !== 'screen');
  protected readonly showScreen = computed(() => this.focus() !== 'fitness');

  protected readonly form = inject(FormBuilder).nonNullable.group({
    moodScore: 7,
    sleepHours: 7.5,
    feelingRested: true,
    sleepNote: '',
    runningKm: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    screenHours: 3,
    metWithFriends: false,
    socialContext: '',
    note: '',
  });

  protected readonly values = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  protected readonly moodEmoji = computed(() => MOOD_EMOJI[this.values().moodScore - 1]);
  protected readonly moodLabel = computed(() => moodLabel(this.values().moodScore));
  protected readonly foodEmoji = computed(() => {
    const score = this.ratingFresh() ? this.rating()?.score : undefined;
    if (score === undefined) return '🍽️';
    return score < 30 ? '🍟' : score < 60 ? '🍝' : score < 80 ? '🥪' : '🥗';
  });
  /** Colour of the verdict box: only a 75+ day reads as green, the rest step down to red. */
  protected readonly foodTone = computed(() => {
    const score = this.ratingFresh() ? this.rating()?.score : undefined;
    if (score === undefined) return 'neutral';
    return score >= 75 ? 'good' : score >= 50 ? 'okay' : score >= 25 ? 'poor' : 'bad';
  });

  /** Filled share of a range track, 0–100, used to paint the soft progress on sliders. */
  protected fill(value: number, min: number, max: number): number {
    return ((value - min) / (max - min)) * 100;
  }

  /**
   * `need` jumps to that need's question. With an existing entry it's a one-question edit;
   * a brand new entry still walks every step, so nothing gets saved as a made-up default.
   */
  open(existing?: DailyCheckIn, need?: StatKey): void {
    this.isEdit.set(!!existing);
    this.focus.set(existing && need ? need : null);
    this.step.set(need ? STEP_OF[need] : 0);
    this.form.reset();
    this.existing = existing;
    this.cancelRating();
    const meals = existing?.food.meals ?? [];
    this.foodEntries.set(meals);
    this.rating.set(existing?.food.rating);
    this.ratedFor.set(existing?.food.rating ? meals : undefined);
    if (existing) {
      this.form.setValue({
        moodScore: existing.mood.score,
        sleepHours: existing.sleep.durationHours,
        feelingRested: existing.sleep.feelingRested,
        sleepNote: existing.sleep.qualityNote ?? '',
        runningKm: existing.metrics.runningDistanceKm,
        screenHours: existing.metrics.screenTimeHours,
        metWithFriends: existing.social.metWithFriends,
        socialContext: existing.social.context ?? '',
        note: existing.note ?? '',
      });
    } else {
      this.prefillFromWearable();
    }
    this.mealsDate = existing?.date ?? this.store.today();
    // Every open pulls the diary again and rates it again, an edit included: meals keep being
    // logged all day. Hand edits survive the merge. Fixing another need leaves the food alone.
    this.loadMeals(!need || need === 'nutrition');
    this.dialog().nativeElement.showModal();
  }

  /**
   * Fetched on every open, since meals keep being logged all day. `merge` puts the diary's
   * items into the list (see mergeDiary): on a new entry's open, and on "Pobierz jeszcze raz".
   */
  private loadMeals(merge: boolean): void {
    this.mealsRequest?.unsubscribe();
    this.mealDay.set(undefined);
    if (!this.diet()) {
      this.mealsStatus.set('idle');
      return;
    }
    this.mealsStatus.set('loading');
    this.mealsRequest = this.api.fetchMeals(this.mealsDate).subscribe({
      next: (day) => {
        this.mealDay.set(day);
        this.mealsStatus.set('idle');
        // Also when the diary is now empty: what was removed there must leave the list too.
        if (merge) {
          this.foodEntries.set(mergeDiary(this.foodEntries(), day));
          this.requestRating();
        }
      },
      error: (err: unknown) => {
        // 409: the Fitatu session ended — show the source as disconnected, ask the user instead.
        if (err instanceof HttpErrorResponse && err.status === 409) {
          this.sources.refresh().subscribe();
          this.mealsStatus.set('idle');
          return;
        }
        this.mealsStatus.set('error');
      },
    });
  }

  /** For a meal logged in the diary while the dialog is open. */
  protected reloadMeals(): void {
    this.loadMeals(true);
  }

  /** Changes by hand aren't sent to the AI: the user asks for a rating when the list is done. */
  protected onFoodEdited(next: FoodEntry[]): void {
    this.foodEntries.set(next);
  }

  /**
   * Rates the list as it is now: right after a pull from the diary, and on "Poproś Pimpka
   * o ocenę". Without the AI (no key, an error) the estimate stands in.
   */
  protected requestRating(): void {
    this.cancelRating();
    const entries = this.foodEntries();
    if (!entries.length) return;
    this.ratingStatus.set('loading');
    const done = (rating: FoodRating) => {
      this.rating.set(rating);
      this.ratedFor.set(entries);
      this.ratingStatus.set('idle');
    };
    this.ratingRequest = this.api.rateFood(ratingRequest(this.mealsDate, entries)).subscribe({
      next: done,
      error: () => done(estimateFoodRating(entries)),
    });
  }

  private cancelRating(): void {
    this.ratingRequest?.unsubscribe();
    this.ratingStatus.set('idle');
  }

  /** Whatever the watch already knows becomes the starting value — the user confirms or corrects it. */
  private prefillFromWearable(): void {
    const m = this.measured();
    if (!m) return;
    const km = this.measuredKm();
    const goal = this.goals().sleepHours;
    const rested =
      m.sleepScore !== undefined
        ? m.sleepScore >= RESTED_SLEEP_SCORE
        : m.sleepHours !== undefined
          ? m.sleepHours >= goal - 0.5
          : undefined;
    this.form.patchValue({
      ...(m.sleepHours !== undefined && { sleepHours: m.sleepHours }),
      ...(rested !== undefined && { feelingRested: rested }),
      ...(km !== undefined && { runningKm: km }),
    });
  }

  /** Puts the watch's reading back after the user moved away from it. */
  protected useMeasured(field: 'sleepHours' | 'runningKm'): void {
    const m = this.measured();
    if (field === 'sleepHours' && m?.sleepHours !== undefined) {
      this.form.controls.sleepHours.setValue(m.sleepHours);
    } else if (field === 'runningKm') {
      const km = this.measuredKm();
      if (km !== undefined) this.form.controls.runningKm.setValue(km);
    }
  }

  close(): void {
    this.cancelRating();
    this.mealsRequest?.unsubscribe();
    this.dialog().nativeElement.close();
  }

  protected onDialogClick(event: MouseEvent): void {
    // Clicks on the inner panel never target the <dialog> itself — only the backdrop does.
    if (event.target === this.dialog().nativeElement) this.close();
  }

  protected next(): void {
    if (this.isLastStep()) {
      this.submit();
    } else {
      this.step.update((s) => s + 1);
    }
  }

  protected back(): void {
    this.step.update((s) => Math.max(0, s - 1));
  }

  protected adjustKm(delta: number): void {
    const km = this.form.controls.runningKm;
    km.setValue(Math.max(0, Math.round(((km.value ?? 0) + delta) * 10) / 10));
  }

  private submit(): void {
    if (this.form.invalid) {
      this.step.set(3);
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const meals = this.foodEntries();
    // Not rated since the last change by hand (or the AI hasn't answered yet): the estimate
    // fits the list as it is now, an older rating doesn't.
    const rating = !meals.length ? undefined : this.ratingFresh() ? this.rating() : estimateFoodRating(meals);
    const input: CheckInInput = {
      date: this.store.today(),
      mood: { score: v.moodScore, label: moodLabel(v.moodScore) },
      sleep: {
        durationHours: v.sleepHours,
        feelingRested: v.feelingRested,
        qualityNote: v.sleepNote.trim() || undefined,
      },
      food: {
        qualityScore: rating?.score ?? this.existing?.food.qualityScore ?? NOTHING_LOGGED_SCORE,
        meals: meals.length ? meals : undefined,
        rating,
        note: this.existing?.food.note,
      },
      metrics: {
        runningDistanceKm: v.runningKm ?? 0,
        screenTimeHours: v.screenHours,
        steps: this.measured()?.steps,
      },
      social: {
        metWithFriends: v.metWithFriends,
        context: (v.metWithFriends && v.socialContext.trim()) || undefined,
      },
      note: v.note.trim() || undefined,
    };
    this.store.save(input).subscribe((result) => {
      this.close();
      this.saved.emit(result);
    });
  }
}
