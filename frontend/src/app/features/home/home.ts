import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { MoodEntry } from '../../core/models/journal.model';
import { PetStore } from '../../core/state/pet.store';
import { SettingsStore } from '../../core/state/settings.store';
import { Icon } from '../../shared/icon/icon';
import { Sheet } from '../../shared/sheet/sheet';
import { Journal } from '../journal/journal';
import { MoodDialog } from '../journal/mood-dialog';
import { Cuddle, Pimpek } from '../pimpek/pimpek';
import { Room, ROOMS } from '../pimpek/rooms';
import { SettingsPanel } from '../settings/settings-panel';

const CELEBRATION_MS = 1800;
const SLIDE_MS = 380;

function greetingFor(hour: number): string {
  if (hour < 5 || hour >= 22) return 'Późno już, czas na sen';
  if (hour < 12) return 'Dzień dobry';
  if (hour < 18) return 'Hej, miło Cię widzieć';
  return 'Dobry wieczór';
}

/** Pimpek's home — the only full screen, with his room, the bathroom and the playroom. Everything else slides up as a sheet. */
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
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');

  protected readonly greeting = greetingFor(new Date().getHours());
  protected readonly rooms = ROOMS;
  protected readonly room = signal<Room>('home');
  private readonly roomIndex = computed(() => ROOMS.findIndex((r) => r.id === this.room()));
  protected readonly current = computed(() => ROOMS[this.roomIndex()]);
  /** The rooms behind the left and right arrows; none past the ends. */
  protected readonly leftRoom = computed(() => ROOMS[this.roomIndex() - 1]);
  protected readonly rightRoom = computed(() => ROOMS[this.roomIndex() + 1]);
  protected readonly celebrating = signal(false);
  /** While Pimpek is hugged the room warms up; while breathing, its glow breathes along. */
  protected readonly cuddle = signal<Cuddle | null>(null);

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

  /** Next room over; the new one slides in from the side the arrow pointed to. */
  protected go(step: -1 | 1): void {
    const next = ROOMS[this.roomIndex() + step];
    if (!next) return;
    this.room.set(next.id);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.stage().nativeElement.animate(
      [
        { transform: `translateX(${step * 40}%)`, opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: SLIDE_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  }

  protected openSettings(): void {
    this.settingsSheet().open();
  }

  protected onSaved(): void {
    this.celebrate();
  }

  private celebrate(): void {
    this.celebrating.set(true);
    setTimeout(() => this.celebrating.set(false), CELEBRATION_MS);
  }
}
