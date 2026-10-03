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
import { GOALS, moodLabel } from '../../core/state/pet-rules';
import { PetStore, SaveResult } from '../../core/state/pet.store';

const STEPS = [
  { title: 'Nastrój', icon: '😊' },
  { title: 'Sen', icon: '💤' },
  { title: 'Jedzenie', icon: '🍎' },
  { title: 'Ruch i ekran', icon: '🏃' },
  { title: 'Ludzie', icon: '🫶' },
] as const;

const MOOD_EMOJI = ['😫', '😣', '😞', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩'];

@Component({
  selector: 'app-check-in-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './check-in-dialog.html',
  styleUrl: './check-in-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckInDialog {
  private readonly store = inject(PetStore);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly saved = output<SaveResult>();

  protected readonly steps = STEPS;
  protected readonly goals = GOALS;
  protected readonly step = signal(0);
  protected readonly isEdit = signal(false);
  protected readonly saving = this.store.saving;
  protected readonly isLastStep = computed(() => this.step() === STEPS.length - 1);

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

  open(existing?: DailyCheckIn): void {
    this.isEdit.set(!!existing);
    this.step.set(0);
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
    }
    this.dialog().nativeElement.showModal();
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
      metrics: { runningDistanceKm: v.runningKm ?? 0, screenTimeHours: v.screenHours },
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
