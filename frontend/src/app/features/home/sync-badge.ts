import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { SourcesStore } from '../../core/state/sources.store';
import { SyncStore } from '../../core/state/sync.store';
import { Icon, IconName } from '../../shared/icon/icon';

/**
 * Header cloud that tells whether Pimpek's data is fresh. It never blocks the room:
 * the narration lives in Pimpek's speech bubble, this is only the quiet indicator.
 */
@Component({
  selector: 'app-sync-badge',
  imports: [Icon],
  template: `
    <button
      type="button"
      class="icon-btn"
      [class]="status()"
      [class.stale]="sync.stale()"
      [attr.aria-label]="label()"
      [title]="label()"
      (click)="onClick()"
    >
      <app-icon [name]="icon()" />
      @if (status() === 'error' || status() === 'offline' || status() === 'disconnected') {
        <span class="dot" aria-hidden="true"></span>
      }
    </button>
  `,
  styles: `
    button {
      position: relative;
    }
    .syncing app-icon {
      animation: spin 1.4s linear infinite;
      color: var(--terracotta-600);
    }
    .ok app-icon {
      color: var(--sage-700);
    }
    .ok.stale app-icon {
      color: var(--honey-700);
    }
    .dot {
      position: absolute;
      top: 0.35rem;
      right: 0.35rem;
      width: 0.6rem;
      height: 0.6rem;
      border: 2px solid var(--surface-alt);
      border-radius: 50%;
      background: var(--terracotta-400);
    }
    .disconnected .dot {
      background: var(--honey-400);
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SyncBadge {
  protected readonly sync = inject(SyncStore);
  private readonly sources = inject(SourcesStore);

  /** No wearable yet — the host opens the place where one can be connected. */
  readonly connectRequested = output<void>();

  protected readonly status = this.sync.status;

  protected readonly icon = computed<IconName>(() => {
    switch (this.status()) {
      case 'syncing':
        return 'refresh';
      case 'offline':
      case 'disconnected':
        return 'cloud-off';
      default:
        return 'cloud';
    }
  });

  protected readonly label = computed(() => {
    const name = this.sources.primary()?.name;
    switch (this.status()) {
      case 'disconnected':
        return 'Brak połączonego zegarka. Połącz źródło danych';
      case 'syncing':
        return `Synchronizuję z ${name}…`;
      case 'error':
        return `Nie udało się pobrać danych z ${name}. Spróbuj ponownie`;
      case 'offline':
        return 'Brak internetu, pokazuję zapamiętane dane';
      default:
        return `${name}: zsynchronizowano ${this.sync.since()}. Odśwież`;
    }
  });

  protected onClick(): void {
    if (this.status() === 'disconnected') this.connectRequested.emit();
    else this.sync.sync();
  }
}
