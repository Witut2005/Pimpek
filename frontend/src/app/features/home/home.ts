import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { MoodEntry } from '../../core/models/journal.model';
import { PetStore } from '../../core/state/pet.store';
import { SettingsStore } from '../../core/state/settings.store';
import { Icon } from '../../shared/icon/icon';
import { Sheet } from '../../shared/sheet/sheet';
import { Journal } from '../journal/journal';
import { MoodDialog } from '../journal/mood-dialog';
import { Cuddle, Pimpek } from '../pimpek/pimpek';
import { SettingsPanel } from '../settings/settings-panel';

const CELEBRATION_MS = 1800;

function greetingFor(hour: number): string {
  if (hour < 5 || hour >= 22) return 'Późno już, czas na sen';
  if (hour < 12) return 'Dzień dobry';
  if (hour < 18) return 'Hej, miło Cię widzieć';
  return 'Dobry wieczór';
}

/** Pimpek's room — the only full screen. Everything else slides up as a sheet. */
@Component({
  selector: 'app-home',
  imports: [Pimpek, MoodDialog, Sheet, Journal, SettingsPanel, Icon],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  protected readonly store = inject(PetStore);
  protected readonly settings = inject(SettingsStore);
  private readonly moodDialog = viewChild.required(MoodDialog);
  private readonly settingsSheet = viewChild.required<Sheet>('settingsSheet');

  protected readonly greeting = greetingFor(new Date().getHours());
  protected readonly celebrating = signal(false);
  /** While Pimpek is hugged the room warms up; while breathing, its glow breathes along. */
  protected readonly cuddle = signal<Cuddle | null>(null);
  protected readonly askReminders = signal(false);

  /** "Dodaj wpis": today's entry, or an offer to edit it if today already has one. */
  protected addEntry(): void {
    this.moodDialog().open();
  }

  /** Fills in a day that was skipped, straight from the journal calendar. */
  protected addEntryOn(date: string): void {
    this.moodDialog().open(undefined, date);
  }

  protected editEntry(entry: MoodEntry): void {
    this.moodDialog().open(entry);
  }

  protected openSettings(): void {
    this.settingsSheet().open();
  }

  protected onSaved(): void {
    this.celebrate();
    // Ask about reminders only once Pimpek has proven useful, never on the first screen.
    if (!this.settings.settings().reminders.asked) setTimeout(() => this.askReminders.set(true), 2500);
  }

  protected answerReminders(enabled: boolean): void {
    this.settings.updateReminders({ enabled, asked: true });
    this.askReminders.set(false);
  }

  private celebrate(): void {
    this.celebrating.set(true);
    setTimeout(() => this.celebrating.set(false), CELEBRATION_MS);
  }
}
