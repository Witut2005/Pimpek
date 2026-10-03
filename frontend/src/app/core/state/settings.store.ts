import { computed, effect, Injectable, signal } from '@angular/core';
import { DEFAULT_SETTINGS, Goals, PET_COLORS, Reminders, Settings } from '../models/settings.model';
import { KEYS, readJson, writeJson } from '../../shared/storage';

function load(): Settings {
  const stored = readJson<Partial<Settings>>(KEYS.settings, {});
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    goals: { ...DEFAULT_SETTINGS.goals, ...stored.goals },
    reminders: { ...DEFAULT_SETTINGS.reminders, ...stored.reminders },
  };
}

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  readonly settings = signal<Settings>(load());

  readonly goals = computed(() => this.settings().goals);
  readonly petName = computed(() => this.settings().petName.trim() || 'Pimpek');
  readonly petHex = computed(() => PET_COLORS[this.settings().petColor].hex);

  constructor() {
    effect(() => writeJson(KEYS.settings, this.settings()));
  }

  update(patch: Partial<Settings>): void {
    this.settings.update((s) => ({ ...s, ...patch }));
  }

  updateGoals(patch: Partial<Goals>): void {
    this.settings.update((s) => ({ ...s, goals: { ...s.goals, ...patch } }));
  }

  updateReminders(patch: Partial<Reminders>): void {
    this.settings.update((s) => ({ ...s, reminders: { ...s.reminders, ...patch } }));
  }

  replace(settings: Settings): void {
    this.settings.set(settings);
  }
}
