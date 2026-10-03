import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ProfileSummary } from '../models/profile.model';
import { WearableApi } from '../services/wearable-api';
import { PetStore } from './pet.store';
import { StatKey } from './pet-rules';
import { findPatterns, fingerprint, PROFILE_MIN_ENTRIES, profileRequest, recentCheckIns } from './profile-rules';
import { KEYS, readJson, writeJson } from '../../shared/storage';

/** `off`: the backend has no Gemini key, so only the rule-based patterns are there. */
export type ProfileStatus = 'idle' | 'loading' | 'error' | 'off';

/**
 * Who the user is lately, built from their own check-ins and notes. Everything stays in the
 * browser: the patterns are computed here, and the AI summary is cached in localStorage until
 * the check-ins it was written from change. The backend only relays the request to Gemini.
 */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly pet = inject(PetStore);
  private readonly api = inject(WearableApi);
  private request?: Subscription;

  private readonly recent = computed(() => recentCheckIns(this.pet.checkIns(), this.pet.today()));
  readonly entries = computed(() => this.recent().length);
  readonly enoughData = computed(() => this.entries() >= PROFILE_MIN_ENTRIES);
  readonly patterns = computed(() => findPatterns(this.recent(), this.pet.goals()));

  readonly summary = signal<ProfileSummary | null>(readJson<ProfileSummary | null>(KEYS.profile, null));
  /** False once an entry was added or edited since the summary was written. */
  readonly fresh = computed(() => this.summary()?.basedOn === fingerprint(this.recent()));
  readonly status = signal<ProfileStatus>('idle');

  /** The need to work on first: the AI's pick while its summary is current, else the strongest pattern. */
  readonly focus = computed<StatKey | undefined>(
    () => (this.fresh() ? this.summary()?.focus : undefined) ?? this.patterns()[0]?.need,
  );

  /** Sends the last two weeks, notes included, to Gemini through the backend. */
  refresh(): void {
    const recent = this.recent();
    if (this.status() === 'loading' || recent.length < PROFILE_MIN_ENTRIES) return;
    const basedOn = fingerprint(recent);
    this.status.set('loading');
    this.request = this.api
      .summarizeProfile(profileRequest(recent, this.patterns(), this.pet.goals(), this.pet.today()))
      .subscribe({
        next: ({ focus, headline, summary, observations, tips }) => {
          const saved: ProfileSummary = {
            focus,
            headline,
            summary,
            observations,
            tips,
            generatedAt: new Date().toISOString(),
            basedOn,
            entries: recent.length,
          };
          this.summary.set(saved);
          writeJson(KEYS.profile, saved);
          this.status.set('idle');
        },
        error: (err: unknown) =>
          this.status.set(err instanceof HttpErrorResponse && err.status === 503 ? 'off' : 'error'),
      });
  }

  /** A demo story swapped the check-ins: the old summary is about someone else. */
  clear(): void {
    this.request?.unsubscribe();
    this.summary.set(null);
    this.status.set('idle');
    writeJson(KEYS.profile, null);
  }
}
