import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { bmi, Body, DEFAULT_SETTINGS, PET_COLORS, Reminders, Settings } from '../models/settings.model';
import { SkinStore } from './skin.store';
import { KEYS, readJson, writeJson } from '../../shared/storage';

function load(): Settings {
  const stored = readJson<Partial<Settings>>(KEYS.settings, {});
  const d = DEFAULT_SETTINGS;
  // Field by field, so settings of removed features (goals, focus, bedtime) don't linger.
  return {
    onboarded: stored.onboarded ?? d.onboarded,
    petName: stored.petName ?? d.petName,
    petColor: stored.petColor ?? d.petColor,
    body: { ...d.body, ...stored.body },
    reminders: {
      enabled: stored.reminders?.enabled ?? d.reminders.enabled,
      checkInTime: stored.reminders?.checkInTime ?? d.reminders.checkInTime,
      quietNights: stored.reminders?.quietNights ?? d.reminders.quietNights,
      asked: stored.reminders?.asked ?? d.reminders.asked,
    },
  };
}

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly skins = inject(SkinStore);
  readonly settings = signal<Settings>(load());

  /** Every look is a different Pimpek with a name of its own; petName belongs to the hand-drawn one. */
  readonly petName = computed(() => this.skins.active()?.name ?? (this.settings().petName.trim() || 'Pimpek'));
  readonly petHex = computed(() => PET_COLORS[this.settings().petColor].hex);
  readonly bmi = computed(() => bmi(this.settings().body));

  constructor() {
    effect(() => writeJson(KEYS.settings, this.settings()));
  }

  update(patch: Partial<Settings>): void {
    this.settings.update((s) => ({ ...s, ...patch }));
  }

  updateBody(patch: Partial<Body>): void {
    this.settings.update((s) => ({ ...s, body: { ...s.body, ...patch } }));
  }

  updateReminders(patch: Partial<Reminders>): void {
    this.settings.update((s) => ({ ...s, reminders: { ...s.reminders, ...patch } }));
  }

  replace(settings: Settings): void {
    this.settings.set(settings);
  }
}
