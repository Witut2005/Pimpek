import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { AiProviderId, AiSettings, DEFAULT_AI_SETTINGS } from '../models/ai.model';
import { AI_PROVIDERS } from '../services/ai/ai-providers';
import { KEYS, readJson, writeJson } from '../../shared/storage';

/** Which AI the skin studio talks to, with the user's own key and model for each vendor. */
@Injectable({ providedIn: 'root' })
export class AiSettingsStore {
  readonly providers = inject(AI_PROVIDERS);
  readonly settings = signal<AiSettings>({ ...DEFAULT_AI_SETTINGS, ...readJson(KEYS.ai, {}) });

  readonly provider = computed(
    () => this.providers.find((p) => p.id === this.settings().provider) ?? this.providers[0],
  );
  readonly apiKey = computed(() => this.settings().keys[this.provider().id]?.trim() ?? '');
  readonly model = computed(
    () => this.settings().models[this.provider().id]?.trim() || this.provider().defaultModel,
  );

  constructor() {
    // Without "remember" the keys live only in memory and are gone after a reload.
    effect(() => {
      const settings = this.settings();
      writeJson(KEYS.ai, settings.remember ? settings : { ...settings, keys: {} });
    });
  }

  select(provider: AiProviderId): void {
    this.settings.update((s) => ({ ...s, provider }));
  }

  setKey(key: string): void {
    const id = this.provider().id;
    this.settings.update((s) => ({ ...s, keys: { ...s.keys, [id]: key } }));
  }

  setModel(model: string): void {
    const id = this.provider().id;
    this.settings.update((s) => ({ ...s, models: { ...s.models, [id]: model } }));
  }

  setRemember(remember: boolean): void {
    this.settings.update((s) => ({ ...s, remember }));
  }
}
