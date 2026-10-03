import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FoodEntry, MEAL_SLOTS } from '../../core/models/meals.model';
import { groupByMeal, mealAt, sortByMeal, sumNutrients } from '../../core/state/food-entries';
import { Icon } from '../../shared/icon/icon';

interface Draft {
  meal: string;
  name: string;
  amount: string;
  kcal: string;
}

/** `editing()` while adding, instead of an entry's id. */
const NEW = 'new';
const MAX_KCAL = 10_000;
const NO_MACROS = { protein: undefined, fat: undefined, carbs: undefined, fiber: undefined, sugars: undefined };

function draftOf(entry: FoodEntry): Draft {
  return {
    meal: entry.meal,
    name: entry.name,
    amount: entry.amount ?? '',
    kcal: entry.kcal === undefined ? '' : String(Math.round(entry.kcal)),
  };
}

function parseKcal(text: string): number | undefined {
  const value = Number(text.replace(',', '.'));
  return text.trim() && Number.isFinite(value) ? Math.min(MAX_KCAL, Math.max(0, value)) : undefined;
}

/**
 * The day's food as an editable list: diary items to fix or drop, and food typed in by hand.
 * It sits inside the check-in's form, so it has no form of its own and Enter never submits.
 */
@Component({
  selector: 'app-food-step',
  imports: [Icon, NgTemplateOutlet],
  templateUrl: './food-step.html',
  styleUrl: './food-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoodStep {
  readonly entries = input.required<FoodEntry[]>();
  readonly entriesChange = output<FoodEntry[]>();

  protected readonly groups = computed(() => groupByMeal(this.entries()));
  protected readonly totalKcal = computed(() => Math.round(sumNutrients(this.entries()).kcal));
  protected readonly withoutKcal = computed(() => this.entries().filter((e) => e.kcal === undefined).length);

  /** An entry's id, `new` while adding, or null. */
  protected readonly editing = signal<string | null>(null);
  /** What the inputs start with. Typing only updates `draft`, so the cursor never jumps. */
  protected readonly initial = signal<Draft>({ meal: '', name: '', amount: '', kcal: '' });
  protected readonly draft = signal<Draft>(this.initial());
  /** The picker's meals, plus a diary meal it doesn't know (when editing one of its items). */
  protected readonly slots = computed(() => {
    const meal = this.initial().meal;
    if (!meal || MEAL_SLOTS.some((s) => s.key === meal)) return MEAL_SLOTS;
    return [...MEAL_SLOTS, { key: meal, name: this.entries().find((e) => e.meal === meal)?.mealName ?? meal }];
  });

  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  protected readonly round = Math.round;

  constructor() {
    effect(() => this.nameInput()?.nativeElement.focus());
  }

  protected add(): void {
    this.start(NEW, { meal: mealAt(new Date().getHours()), name: '', amount: '', kcal: '' });
  }

  protected edit(entry: FoodEntry): void {
    this.start(entry.id, draftOf(entry));
  }

  protected patch(key: keyof Draft, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  protected cancel(): void {
    this.editing.set(null);
  }

  protected save(event?: Event): void {
    event?.preventDefault();
    const d = this.draft();
    const name = d.name.trim();
    if (!name) return;
    const change = {
      meal: d.meal,
      mealName: this.slots().find((s) => s.key === d.meal)?.name ?? d.meal,
      name,
      amount: d.amount.trim() || undefined,
    };
    const id = this.editing();
    if (id === NEW) {
      this.emit([...this.entries(), { id: crypto.randomUUID(), ...change, kcal: parseKcal(d.kcal) }]);
    } else {
      this.emit(this.entries().map((e) => (e.id === id ? this.changed(e, change, d.kcal) : e)));
    }
    this.editing.set(null);
  }

  protected remove(entry: FoodEntry): void {
    if (this.editing() === entry.id) this.editing.set(null);
    this.emit(this.entries().filter((e) => e.id !== entry.id));
  }

  private start(id: string, draft: Draft): void {
    this.initial.set(draft);
    this.draft.set(draft);
    this.editing.set(id);
  }

  /** A different food or portion makes the diary's macros wrong, so the AI estimates them. */
  private changed(entry: FoodEntry, change: Pick<FoodEntry, 'meal' | 'mealName' | 'name' | 'amount'>, kcal: string): FoodEntry {
    const before = draftOf(entry);
    const untouched = (Object.keys(before) as (keyof Draft)[]).every((k) => before[k] === this.draft()[k].trim());
    if (untouched) return entry;
    const sameFood = change.name === entry.name && change.amount === entry.amount;
    return {
      ...entry,
      ...change,
      // Rounded for display: only a kcal the user actually changed replaces the diary's value.
      kcal: kcal.trim() === before.kcal ? entry.kcal : parseKcal(kcal),
      ...(!sameFood && NO_MACROS),
      edited: true,
    };
  }

  private emit(entries: FoodEntry[]): void {
    this.entriesChange.emit(sortByMeal(entries));
  }
}
