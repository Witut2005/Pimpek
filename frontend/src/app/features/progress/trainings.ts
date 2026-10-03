import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SPORTS } from '../../core/models/strava.model';
import { pace, StravaStore } from '../../core/state/strava.store';
import { formatDayMonth, formatDuration, formatKm, formatPace, formatSteps } from '../../shared/format';
import { Icon } from '../../shared/icon/icon';
import { SoftBar, SoftBars } from '../../shared/soft-bars/soft-bars';

/** Imported Strava history in the progress sheet: volume, mix, recent workouts and records. */
@Component({
  selector: 'app-trainings',
  imports: [Icon, SoftBars],
  template: `
    @if (strava.connected()) {
      <section class="card">
        <h3><app-icon name="pulse" /> Treningi <span class="pill">ze Stravy</span></h3>

        <div class="tiles">
          <div><strong>{{ strava.totals().count }}</strong><small>treningów</small></div>
          <div><strong>{{ int(strava.totals().km) }}</strong><small>km</small></div>
          <div><strong>{{ int(strava.totals().hours) }}</strong><small>godzin</small></div>
        </div>

        <app-soft-bars [bars]="weeks()" [max]="maxWeek()" />
        <p class="muted">{{ weekSentence() }}</p>

        <div class="chips">
          @for (s of strava.bySport(); track s.sport) {
            <span class="pill warm">{{ s.emoji }} {{ s.label }} · {{ s.count }}</span>
          }
        </div>

        <h4>Ostatnio</h4>
        <ul class="recent">
          @for (a of strava.recent(); track a.id) {
            <li>
              <span class="emoji" aria-hidden="true">{{ sports[a.sport].emoji }}</span>
              <div class="what">
                <strong>{{ a.name }}</strong>
                <small>{{ day(a.date) }} · {{ a.start }}</small>
              </div>
              <div class="how">
                @if (a.distanceKm) {
                  <strong>{{ km(a.distanceKm) }}</strong>
                }
                <small>
                  {{ duration(a.movingMinutes) }}
                  @if (a.sport === 'Run') {
                    · {{ paceOf(a) }}
                  }
                </small>
              </div>
            </li>
          }
        </ul>

        @if (strava.records().longestRun; as r) {
          <p class="record">
            <app-icon name="trophy" /> Najdłuższy bieg: <strong>{{ km(r.distanceKm) }}</strong>, {{ day(r.date) }}
          </p>
        }
        @if (strava.records().biggestClimb; as r) {
          <p class="record">
            <app-icon name="mountain" /> Najwięcej w górę: <strong>{{ int(r.elevationM) }} m</strong>, {{ r.name }}
          </p>
        }
      </section>
    } @else {
      <p class="hint">
        <app-icon name="pulse" /> Masz Stravę? Połącz ją w „Ty i Pimpek” → Źródła danych, a zobaczysz tu
        swoje treningi z przeszłości.
      </p>
    }
  `,
  styles: `
    h3 {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      margin: 0;
      font-size: 1.05rem;
    }
    h4 {
      margin: 0.2rem 0 0;
      font-size: 0.95rem;
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
    }
    .tiles div {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.6rem 0.3rem;
      border-radius: 1.2rem;
      background: var(--surface);
      box-shadow: var(--shadow-pressed);
    }
    .tiles strong {
      color: var(--terracotta-600);
      font-size: 1.3rem;
      font-variant-numeric: tabular-nums;
    }
    .tiles small,
    small {
      color: var(--text-muted);
      font-weight: 700;
    }
    .recent {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .recent li {
      display: grid;
      grid-template-columns: 2rem 1fr auto;
      align-items: center;
      gap: 0.6rem;
      padding: 0.55rem 0.7rem;
      border-radius: 1.1rem;
      background: var(--surface);
    }
    .emoji {
      font-size: 1.35rem;
      text-align: center;
    }
    .what,
    .how {
      display: flex;
      flex-direction: column;
      min-width: 0;
      line-height: 1.25;
    }
    .what strong {
      overflow: hidden;
      font-size: 0.92rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .how {
      align-items: flex-end;
      text-align: right;
    }
    .record {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin: 0;
      font-size: 0.9rem;
    }
    .record strong {
      color: var(--terracotta-600);
    }
    .hint {
      display: flex;
      gap: 0.5rem;
      margin: 0;
      padding: 0.85rem 1rem;
      border: 2px dashed var(--track);
      border-radius: 1.4rem;
      color: var(--text-muted);
      font-size: 0.9rem;
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Trainings {
  protected readonly strava = inject(StravaStore);
  protected readonly sports = SPORTS;

  protected readonly int = formatSteps;
  protected readonly km = formatKm;
  protected readonly day = formatDayMonth;
  protected readonly duration = formatDuration;
  protected readonly paceOf = (a: Parameters<typeof pace>[0]) => formatPace(pace(a));

  protected readonly weeks = computed<SoftBar[]>(() =>
    this.strava.weeklyKm().map((w, i, all) => ({
      // Every third label keeps twelve bars readable on a phone.
      label: i === all.length - 1 ? 'teraz' : i % 3 === 0 ? w.end.slice(8) + '.' + w.end.slice(5, 7) : '',
      value: w.km,
      title: `Tydzień do ${formatDayMonth(w.end)}: ${formatKm(w.km)}`,
      today: i === all.length - 1,
    })),
  );

  protected readonly maxWeek = computed(() => Math.max(10, ...this.strava.weeklyKm().map((w) => w.km)) * 1.1);

  protected readonly weekSentence = computed(() => {
    const done = this.strava.weeklyKm().slice(0, -1);
    const avg = done.reduce((s, w) => s + w.km, 0) / Math.max(1, done.length);
    return `Średnio ${formatKm(avg)} tygodniowo przez ostatnie ${done.length} tygodni.`;
  });
}
