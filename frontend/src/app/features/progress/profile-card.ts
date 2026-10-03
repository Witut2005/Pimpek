import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PROFILE_DAYS, patternSpan } from '../../core/state/profile-rules';
import { ProfileStore } from '../../core/state/profile.store';
import { SettingsStore } from '../../core/state/settings.store';
import { Icon } from '../../shared/icon/icon';
import { NEEDS } from '../needs/needs';

/** "3 wpisy", "5 wpisów", "22 wpisy". */
const entriesLabel = (n: number) => {
  const tens = n % 100;
  const form = n === 1 ? 'wpis' : n % 10 >= 2 && n % 10 <= 4 && (tens < 12 || tens > 14) ? 'wpisy' : 'wpisów';
  return `${n} ${form}`;
};

/**
 * What Pimpek has noticed about the user lately. The rule-based patterns show right away;
 * the AI summary, built from the check-ins and their notes, only on request.
 */
@Component({
  selector: 'app-profile-card',
  imports: [Icon, DatePipe],
  host: { class: 'card' },
  template: `
    <h3><app-icon name="sparkle" /> {{ petName() }} o Tobie</h3>

    @if (!profile.enoughData()) {
      <p class="muted">Po kilku wpisach {{ petName() }} zacznie zauważać, co się u Ciebie powtarza.</p>
    } @else {
      @if (current(); as s) {
        <strong class="headline">{{ s.headline }}</strong>
        <p class="summary">{{ s.summary }}</p>
      }

      @if (focusNeed(); as need) {
        <div class="focus">
          <span class="badge"><app-icon [name]="need.icon" /></span>
          <span class="text">
            <small>Nad tym popracujmy</small>
            <strong>{{ need.label }}</strong>
          </span>
        </div>
      }

      @if (current(); as s) {
        @if (s.observations.length) {
          <ul class="points">
            @for (point of s.observations; track $index) {
              <li>{{ point }}</li>
            }
          </ul>
        }
        @if (s.tips.length) {
          <ul class="points tips">
            @for (tip of s.tips; track $index) {
              <li><app-icon name="check" /> {{ tip }}</li>
            }
          </ul>
        }
        <small class="muted">
          Na podstawie: {{ entriesLabel(s.entries) }} · {{ s.generatedAt | date: 'd MMM, HH:mm' }}
        </small>
      } @else {
        @if (patterns().length) {
          <ul class="points">
            @for (p of patterns(); track p.signal) {
              <li>
                <app-icon [name]="needs[p.need].icon" />
                <span><strong>{{ p.label }}</strong> · {{ span(p) }}</span>
              </li>
            }
          </ul>
        } @else {
          <p class="muted">W ostatnich dniach nic złego się nie powtarza. Oby tak dalej!</p>
        }

        @switch (profile.status()) {
          @case ('loading') {
            <p class="muted" role="status">{{ petName() }} czyta Twoje wpisy…</p>
          }
          @case ('off') {
            <p class="muted" role="status">
              Podsumowanie AI jest wyłączone na serwerze (brak klucza Gemini). Wyżej to, co widać bez AI.
            </p>
          }
          @case ('error') {
            <p class="muted" role="status">Nie udało się zapytać AI. Spróbuj za chwilę.</p>
          }
        }
        @if (profile.status() !== 'loading' && profile.status() !== 'off') {
          <button type="button" class="btn soft small" (click)="profile.refresh()">
            <app-icon name="sparkle" />
            {{ profile.summary() ? 'Odśwież podsumowanie' : 'Podsumuj moje dni z AI' }}
          </button>
          <small class="muted">
            Wpisy z ostatnich {{ days }} dni, razem z notatkami, trafią do Gemini (Google).
          </small>
        }
      }
    }
  `,
  styles: `
    .headline {
      font-size: 1.1rem;
    }
    .summary {
      margin: 0;
      line-height: 1.45;
    }
    .focus {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      padding: 0.55rem 0.7rem;
      border-radius: 1.3rem 1.5rem 1.2rem 1.4rem;
      background: var(--accent-soft);
    }
    .badge {
      display: grid;
      place-items: center;
      width: 2.2rem;
      height: 2.2rem;
      border-radius: 45% 55% 50% 50% / 55% 45% 55% 45%;
      background: var(--surface-alt);
      color: var(--accent);
      font-size: 1.05rem;
    }
    .text {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
    }
    .text small {
      color: var(--text-muted);
      font-size: 0.75rem;
      font-weight: 700;
    }
    .points {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .points li {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      line-height: 1.35;
    }
    .points app-icon {
      flex: none;
      margin-top: 0.1rem;
      color: var(--accent);
    }
    .tips li {
      color: var(--text-muted);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
    }
    small.muted {
      font-size: 0.75rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileCard {
  protected readonly profile = inject(ProfileStore);
  protected readonly petName = inject(SettingsStore).petName;

  protected readonly needs = NEEDS;
  protected readonly days = PROFILE_DAYS;
  protected readonly span = patternSpan;
  protected readonly entriesLabel = entriesLabel;
  protected readonly patterns = this.profile.patterns;
  /** The AI summary, while the check-ins it read are still the same. */
  protected readonly current = computed(() => (this.profile.fresh() ? this.profile.summary() : null));
  protected readonly focusNeed = computed(() => {
    const focus = this.profile.focus();
    return focus ? NEEDS[focus] : undefined;
  });
}
