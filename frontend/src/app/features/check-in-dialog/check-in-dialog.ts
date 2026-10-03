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
import { map } from 'rxjs';
import { CheckInInput, DailyCheckIn } from '../../core/models/check-in.model';
import { foodLabel, moodLabel, StatKey } from '../../core/state/pet-rules';
import { PetStore, SaveResult } from '../../core/state/pet.store';
import { SettingsStore } from '../../core/state/settings.store';
import { SourcesStore } from '../../core/state/sources.store';
import { formatHours, formatKm, formatSteps } from '../../shared/format';
import { Icon, IconName } from '../../shared/icon/icon';
import { NEEDS } from '../needs/needs';

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

@Component({
  selector: 'app-check-in-dialog',
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './check-in-dialog.html',
  styleUrl: './check-in-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckInDialog {
  private readonly store = inject(PetStore);
  private readonly sources = inject(SourcesStore);
  private readonly settings = inject(SettingsStore);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

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
    foodScore: 70,
    foodNote: '',
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
    const score = this.values().foodScore;
    return score < 30 ? '🍟' : score < 60 ? '🍝' : score < 80 ? '🥪' : '🥗';
  });
  protected readonly foodLabel = computed(() => foodLabel(this.values().foodScore));

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
    if (existing) {
      this.form.setValue({
        moodScore: existing.mood.score,
        sleepHours: existing.sleep.durationHours,
        feelingRested: existing.sleep.feelingRested,
        sleepNote: existing.sleep.qualityNote ?? '',
        foodScore: existing.food.qualityScore,
        foodNote: existing.food.note ?? '',
        runningKm: existing.metrics.runningDistanceKm,
        screenHours: existing.metrics.screenTimeHours,
        metWithFriends: existing.social.metWithFriends,
        socialContext: existing.social.context ?? '',
        note: existing.note ?? '',
      });
    } else {
      this.prefillFromWearable();
    }
    this.dialog().nativeElement.showModal();
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
      ...(m.screenHours !== undefined && { screenHours: m.screenHours }),
    });
  }

  /** Puts the watch's reading back after the user moved away from it. */
  protected useMeasured(field: 'sleepHours' | 'runningKm' | 'screenHours'): void {
    const m = this.measured();
    if (field === 'sleepHours' && m?.sleepHours !== undefined) {
      this.form.controls.sleepHours.setValue(m.sleepHours);
    } else if (field === 'screenHours' && m?.screenHours !== undefined) {
      this.form.controls.screenHours.setValue(m.screenHours);
    } else if (field === 'runningKm') {
      const km = this.measuredKm();
      if (km !== undefined) this.form.controls.runningKm.setValue(km);
    }
  }

  close(): void {
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
    const input: CheckInInput = {
      date: this.store.today(),
      mood: { score: v.moodScore, label: moodLabel(v.moodScore) },
      sleep: {
        durationHours: v.sleepHours,
        feelingRested: v.feelingRested,
        qualityNote: v.sleepNote.trim() || undefined,
      },
      food: { qualityScore: v.foodScore, note: v.foodNote.trim() || undefined },
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
