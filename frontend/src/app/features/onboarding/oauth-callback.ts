import { ChangeDetectionStrategy, Component, computed, effect, inject, input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SOURCES } from '../../core/models/metrics.model';
import { SettingsStore } from '../../core/state/settings.store';
import { SourcesStore } from '../../core/state/sources.store';
import { SyncStore } from '../../core/state/sync.store';
import { PimpekAvatar } from '../pimpek/pimpek-avatar';

const AUTO_RETURN_MS = 1800;

/**
 * Where the provider's OAuth sends the user back (/onboarding/done). In the mock it simply
 * links the source, pulls the first data and returns to where the user came from.
 */
@Component({
  selector: 'app-oauth-callback',
  imports: [PimpekAvatar],
  template: `
    <main class="screen">
      <app-pimpek-avatar
        class="pet"
        [state]="phase() === 'done' ? 'happy' : phase() === 'syncing' ? 'neutral' : 'sad'"
        [celebrating]="phase() === 'done'"
        [color]="settings.petHex()"
      />
      @switch (phase()) {
        @case ('syncing') {
          <h1>Łączę się z {{ info()?.name }}…</h1>
          <p class="muted">Pobieram sen i kroki z ostatnich 4 tygodni</p>
          <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
        }
        @case ('done') {
          <h1>Połączono z {{ info()?.name }}!</h1>
          <p class="muted">{{ settings.petName() }} już wie, jak spałeś/aś.</p>
          <button type="button" class="btn primary" (click)="goBack()">Wracam do Pimpka</button>
        }
        @default {
          <h1>Nie udało się połączyć</h1>
          <p class="muted">Spróbuj jeszcze raz za chwilę. Twoje dane są bezpieczne.</p>
          <button type="button" class="btn primary" (click)="sync.sync()">Spróbuj ponownie</button>
          <button type="button" class="btn ghost" (click)="goBack()">Wróć</button>
        }
      }
    </main>
  `,
  styles: `
    .screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      min-height: 100dvh;
      padding: 2rem 1.5rem;
      text-align: center;
      background: radial-gradient(120% 60% at 50% 0%, var(--sage-200), transparent 70%), var(--bg);
    }
    .pet {
      width: min(50vw, 12rem);
    }
    h1 {
      margin: 0;
      font-size: 1.6rem;
    }
    .dots {
      display: flex;
      gap: 0.4rem;
    }
    .dots i {
      width: 0.7rem;
      height: 0.7rem;
      border-radius: 50%;
      background: var(--terracotta-400);
      animation: bob 1.2s ease-in-out infinite;
    }
    .dots i:nth-child(2) {
      animation-delay: 0.15s;
    }
    .dots i:nth-child(3) {
      animation-delay: 0.3s;
    }
    @keyframes bob {
      50% {
        transform: translateY(-0.5rem);
        opacity: 0.5;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OAuthCallback implements OnInit {
  protected readonly settings = inject(SettingsStore);
  protected readonly sync = inject(SyncStore);
  private readonly sources = inject(SourcesStore);
  private readonly router = inject(Router);

  readonly source = input<string>();
  readonly returnTo = input<string>();

  protected readonly info = computed(() => SOURCES.find((s) => s.id === this.source() && s.web));
  protected readonly phase = computed(() => {
    if (!this.info()) return 'error';
    switch (this.sync.status()) {
      case 'syncing':
        return 'syncing';
      case 'ok':
        return 'done';
      default:
        return 'error';
    }
  });

  constructor() {
    effect((onCleanup) => {
      if (this.phase() !== 'done') return;
      const timer = setTimeout(() => this.goBack(), AUTO_RETURN_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  ngOnInit(): void {
    const info = this.info();
    if (!info) return;
    this.sources.connect(info.id);
    this.sync.sync();
  }

  protected goBack(): void {
    // Only same-app paths: never bounce to another site.
    const target = this.returnTo() ?? '/';
    this.router.navigateByUrl(target.startsWith('/') && !target.startsWith('//') ? target : '/');
  }
}
