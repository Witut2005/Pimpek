import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { MoodEntry, MoodLevel, moodMeta, MOODS, NOTE_MAX_LENGTH } from '../../core/models/journal.model';
import { JournalStore } from '../../core/state/journal.store';
import { PetStore } from '../../core/state/pet.store';
import { formatDayMonth } from '../../shared/format';
import { Icon } from '../../shared/icon/icon';

/**
 * "Dodaj wpis": how do you feel today, plus an optional note. One entry per day, so a day that
 * already has one asks to edit it instead. Also backfills a missed day and edits or deletes any entry.
 */
@Component({
  selector: 'app-mood-dialog',
  imports: [Icon],
  templateUrl: './mood-dialog.html',
  styleUrl: './mood-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoodDialog {
  private readonly pet = inject(PetStore);
  private readonly journal = inject(JournalStore);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** A new entry was added (not emitted for edits or deletes). */
  readonly saved = output<MoodEntry>();

  protected readonly moods = MOODS;
  protected readonly moodMeta = moodMeta;
  protected readonly noteMax = NOTE_MAX_LENGTH;
  protected readonly today = this.pet.today;
  /** The entry being edited, as it was when opened. */
  protected readonly editing = signal<MoodEntry | undefined>(undefined);
  /** "Dodaj wpis" hit a day that already has an entry: offer to edit it instead. */
  protected readonly existing = signal<MoodEntry | undefined>(undefined);
  protected readonly date = signal('');
  protected readonly mood = signal<MoodLevel | undefined>(undefined);
  protected readonly note = signal('');
  protected readonly confirmDelete = signal(false);

  /** Another entry already holds the picked day. */
  protected readonly conflict = computed(() => {
    const other = this.journal.byDate().get(this.date());
    return other && other.date !== this.editing()?.date ? other : undefined;
  });

  protected readonly title = computed(() => {
    if (this.existing()) return 'Ten dzień ma już wpis';
    if (this.editing()) return 'Popraw wpis';
    return this.date() === this.today() ? 'Jak się dziś czujesz?' : 'Uzupełnij dzień';
  });

  protected readonly canSave = computed(
    () => !!this.mood() && !!this.date() && this.date() <= this.today() && !this.conflict(),
  );

  /** No entry: a new one for `day` (today by default), or the edit prompt if that day is taken. */
  open(entry?: MoodEntry, day?: string): void {
    const date = entry?.date ?? day ?? this.today();
    const taken = entry ? undefined : this.journal.byDate().get(date);
    this.existing.set(taken);
    this.editing.set(entry);
    this.date.set(date);
    this.mood.set(entry?.mood);
    this.note.set(entry?.note ?? '');
    this.confirmDelete.set(false);
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) dialog.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  protected dayLabel(date: string): string {
    return date === this.today() ? 'dziś' : formatDayMonth(date);
  }

  protected onDialogClick(event: MouseEvent): void {
    // Clicks on the inner panel never target the <dialog> itself — only the backdrop does.
    if (event.target === this.dialog().nativeElement) this.close();
  }

  protected onNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  protected onDate(event: Event): void {
    this.date.set((event.target as HTMLInputElement).value);
  }

  protected save(): void {
    const mood = this.mood();
    if (!mood || !this.canSave()) return;
    const editing = this.editing();
    const entry = this.journal.save({ date: this.date(), mood, note: this.note().trim() || undefined }, editing?.date);
    this.close();
    this.pet.showMood(mood);
    if (!editing) this.saved.emit(entry);
  }

  protected remove(): void {
    const editing = this.editing();
    if (!editing) return;
    this.journal.remove(editing.date);
    this.close();
  }
}
