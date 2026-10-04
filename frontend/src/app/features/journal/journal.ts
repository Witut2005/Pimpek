import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { MoodEntry, MoodLevel, moodMeta, MOODS } from '../../core/models/journal.model';
import { JournalStore } from '../../core/state/journal.store';
import { PetStore } from '../../core/state/pet.store';
import { addDays, toDateKey } from '../../shared/date';
import { formatMonthYear } from '../../shared/format';
import { Icon } from '../../shared/icon/icon';

const WEEKDAY_HEADERS = ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'];
const DAY_TITLE = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

interface CalendarCell {
  date: string;
  day: number;
  mood?: MoodLevel;
  today: boolean;
  future: boolean;
}

/** `YYYY-MM` shifted by whole months. */
function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  return toDateKey(new Date(y, m - 1 + delta, 1)).slice(0, 7);
}

/**
 * Dziennik: a mood diary. A month calendar painted with each day's mood, how often each mood
 * came up that month, and the entries themselves, newest day first.
 */
@Component({
  selector: 'app-journal',
  imports: [Icon],
  templateUrl: './journal.html',
  styleUrl: './journal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Journal {
  private readonly journal = inject(JournalStore);
  private readonly pet = inject(PetStore);

  /** "Dodaj wpis" from the empty state. */
  readonly add = output<void>();
  /** An empty past day was tapped, to fill it in. */
  readonly addOn = output<string>();
  /** An entry was tapped, to edit or delete it. */
  readonly edit = output<MoodEntry>();

  protected readonly weekdays = WEEKDAY_HEADERS;
  protected readonly moods = MOODS;
  protected readonly moodMeta = moodMeta;

  private readonly currentMonth = computed(() => this.pet.today().slice(0, 7));
  /** Picked by the arrows; follows the current month until then. */
  private readonly pickedMonth = signal<string | undefined>(undefined);
  protected readonly month = computed(() => this.pickedMonth() ?? this.currentMonth());
  protected readonly monthTitle = computed(() => formatMonthYear(this.month()));
  protected readonly isCurrentMonth = computed(() => this.month() >= this.currentMonth());

  /** Leading blanks (Monday first), then one cell per day of the month. */
  protected readonly calendar = computed(() => {
    const [y, m] = this.month().split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const today = this.pet.today();
    const byDate = this.journal.byDate();
    const cells: CalendarCell[] = Array.from({ length: daysInMonth }, (_, i) => {
      const date = addDays(toDateKey(first), i);
      return {
        date,
        day: i + 1,
        mood: byDate.get(date)?.mood,
        today: date === today,
        future: date > today,
      };
    });
    return { blanks: Array.from({ length: (first.getDay() + 6) % 7 }), cells };
  });

  /** Entries of the shown month, newest day first. */
  private readonly monthEntries = computed(() =>
    this.journal.entries().filter((e) => e.date.startsWith(this.month())),
  );

  /** How many times each mood was picked this month. */
  protected readonly counts = computed(() => {
    const entries = this.monthEntries();
    return MOODS.map((m) => ({ ...m, count: entries.filter((e) => e.mood === m.level).length }));
  });

  /** The month's entries, newest day first, each titled with its day. */
  protected readonly days = computed(() => {
    const today = this.pet.today();
    const yesterday = addDays(today, -1);
    return this.monthEntries()
      .filter((entry) => entry.date <= today)
      .map((entry) => {
        const [y, m, d] = entry.date.split('-').map(Number);
        const title =
          entry.date === today ? 'Dziś' : entry.date === yesterday ? 'Wczoraj' : DAY_TITLE.format(new Date(y, m - 1, d));
        return { title, entry };
      });
  });

  protected shift(delta: number): void {
    const next = shiftMonth(this.month(), delta);
    this.pickedMonth.set(next >= this.currentMonth() ? undefined : next);
  }

  /** A day with entries scrolls its group into view; an empty past day opens a new entry for it. */
  protected pickDay(cell: CalendarCell): void {
    if (cell.future) return;
    if (!cell.mood) {
      this.addOn.emit(cell.date);
      return;
    }
    document.getElementById(`journal-${cell.date}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
