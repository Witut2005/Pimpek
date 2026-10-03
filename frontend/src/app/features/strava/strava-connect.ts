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
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { PetItemProgress } from '../../core/models/item.model';
import { STRAVA_NEVER_READ, STRAVA_SCOPES } from '../../core/models/strava.model';
import { ImportPhase, ImportProgress, MockStravaService } from '../../core/services/strava.service';
import { PetStore } from '../../core/state/pet.store';
import { SettingsStore } from '../../core/state/settings.store';
import { SourcesStore } from '../../core/state/sources.store';
import { pace, StravaStore } from '../../core/state/strava.store';
import { WalletStore } from '../../core/state/wallet.store';
import { formatDayMonth, formatDuration, formatKm, formatPace, formatSteps } from '../../shared/format';
import { Icon } from '../../shared/icon/icon';
import { PimpekAvatar } from '../pimpek/pimpek-avatar';

type Step = 'consent' | 'login' | 'authorizing' | 'importing' | 'summary' | 'error';

/** Leaves for bringing the training history along — paid once. */
const WELCOME_BONUS = 25;
const DEMO_EMAIL = 'ola@pimpek.app';

const PHASES: readonly { id: ImportPhase; label: string }[] = [
  { id: 'token', label: 'Autoryzacja w Stravie' },
  { id: 'profile', label: 'Profil sportowca' },
  { id: 'activities', label: 'Treningi z przeszłości' },
  { id: 'analysis', label: 'Rekordy i nawyki' },
];

/**
 * Full-screen Strava flow: consent → placeholder login (stands in for the OAuth page) →
 * history import with live progress → summary of what Pimpek learned. All mock, no backend.
 */
@Component({
  selector: 'app-strava-connect',
  imports: [FormsModule, Icon, PimpekAvatar],
  templateUrl: './strava-connect.html',
  styleUrl: './strava-connect.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StravaConnect {
  private readonly api = inject(MockStravaService);
  private readonly sources = inject(SourcesStore);
  protected readonly pet = inject(PetStore);
  private readonly wallet = inject(WalletStore);
  protected readonly strava = inject(StravaStore);
  protected readonly settings = inject(SettingsStore);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** Emitted when the user closes the summary after a successful import. */
  readonly connected = output<void>();

  protected readonly scopes = STRAVA_SCOPES;
  protected readonly neverRead = STRAVA_NEVER_READ;
  protected readonly phases = PHASES;
  protected readonly periods = [3, 6, 12, 24];
  protected readonly format = { km: formatKm, duration: formatDuration, pace: formatPace, day: formatDayMonth, int: formatSteps };
  protected readonly pace = pace;

  protected readonly step = signal<Step>('consent');
  protected readonly months = signal(12);
  protected readonly withHr = signal(true);
  protected readonly progress = signal<ImportProgress | undefined>(undefined);
  protected readonly firstName = signal('');
  protected readonly bonus = signal(0);
  protected readonly unlocked = signal<PetItemProgress[]>([]);

  protected email = '';
  protected password = '';
  private request?: Subscription;

  protected readonly phaseIndex = computed(() => {
    const phase = this.progress()?.phase;
    return phase ? PHASES.findIndex((p) => p.id === phase) : -1;
  });

  /** 0–100 for the progress bar: the pages are the long part. */
  protected readonly percent = computed(() => {
    const p = this.progress();
    if (!p) return 2;
    switch (p.phase) {
      case 'token':
        return 6;
      case 'profile':
        return 12;
      case 'activities':
        return 12 + (78 * p.page) / p.pages;
      case 'analysis':
        return 96;
    }
  });

  open(): void {
    this.request?.unsubscribe();
    this.step.set('consent');
    this.progress.set(undefined);
    this.bonus.set(0);
    this.unlocked.set([]);
    this.email = '';
    this.password = '';
    this.dialog().nativeElement.showModal();
  }

  protected close(): void {
    // The import keeps nothing half-done: cancelling mid-way simply drops it.
    this.request?.unsubscribe();
    this.dialog().nativeElement.close();
    if (this.step() === 'summary') this.connected.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    const busy = this.step() === 'authorizing' || this.step() === 'importing';
    if (event.target === this.dialog().nativeElement && !busy) this.close();
  }

  protected useDemoAccount(): void {
    this.email = DEMO_EMAIL;
    this.password = 'demo-haslo';
  }

  protected loginValid(): boolean {
    return this.email.includes('@') && this.password.length > 0;
  }

  protected authorize(): void {
    if (!this.loginValid()) return;
    this.step.set('authorizing');
    // The password never goes anywhere: the real version sends the user to Strava's own page.
    this.password = '';
    this.request = this.api.authorize(this.email).subscribe(({ firstName }) => {
      this.firstName.set(firstName);
      this.startImport();
    });
  }

  protected startImport(): void {
    this.step.set('importing');
    const before = new Set(this.pet.items().filter((i) => i.unlocked).map((i) => i.id));
    this.request = this.api.importHistory(this.email, this.months()).subscribe({
      next: (event) => {
        if ('progress' in event) {
          this.progress.set(event.progress);
          return;
        }
        const payBonus = this.strava.save(event.result);
        this.sources.connectLocal('strava');
        if (payBonus) {
          this.wallet.earn(WELCOME_BONUS);
          this.bonus.set(WELCOME_BONUS);
        }
        this.unlocked.set(this.pet.items().filter((i) => i.unlocked && !before.has(i.id)));
        this.step.set('summary');
      },
      error: () => this.step.set('error'),
    });
  }

  protected phaseState(index: number): 'done' | 'current' | 'todo' {
    const current = this.phaseIndex();
    if (index < current) return 'done';
    return index === current ? 'current' : 'todo';
  }
}
