import { computed, inject, Injectable } from '@angular/core';
import { buildScenarioCheckIns, Scenario } from '../mocks/scenarios';
import { DEFAULT_SETTINGS } from '../models/settings.model';
import { MockWearableService } from '../services/wearable.service';
import { ClockStore } from './clock.store';
import { PetStore } from './pet.store';
import { ProfileStore } from './profile.store';
import { QuestStore } from './quest.store';
import { ScenarioStore } from './scenario.store';
import { SettingsStore } from './settings.store';
import { SourcesStore } from './sources.store';
import { SyncStore } from './sync.store';
import { toDateKey } from '../../shared/date';
import { skinDb } from '../../shared/skin-db';
import { clearAll, KEYS, writeJson } from '../../shared/storage';

/** The jury remote: load a story, fast-forward a day, break the sync on purpose. */
@Injectable({ providedIn: 'root' })
export class DemoControls {
  private readonly scenarioStore = inject(ScenarioStore);
  private readonly settings = inject(SettingsStore);
  private readonly sources = inject(SourcesStore);
  private readonly sync = inject(SyncStore);
  private readonly quest = inject(QuestStore);
  private readonly clock = inject(ClockStore);
  private readonly pet = inject(PetStore);
  private readonly profile = inject(ProfileStore);
  private readonly wearableApi = inject(MockWearableService);

  readonly scenario = computed(() => this.scenarioStore.state().scenario);
  readonly dayOffset = this.clock.offsetDays;

  load(scenario: Scenario): void {
    const today = toDateKey(new Date());
    const current = this.settings.settings();
    this.clock.reset();
    this.scenarioStore.set({ scenario, anchor: today });
    this.settings.replace({
      ...DEFAULT_SETTINGS,
      petName: current.petName,
      petColor: current.petColor,
      onboarded: true,
      focus: current.focus,
      reminders: { ...DEFAULT_SETTINGS.reminders, asked: scenario !== 'new' },
    });
    this.sources.replace(
      scenario === 'new'
        ? []
        : [{ id: 'garmin', via: 'demo', connectedAt: new Date().toISOString() }],
    );
    writeJson(KEYS.checkIns, buildScenarioCheckIns(scenario, today, 'garmin'));
    this.profile.clear();
    this.quest.reset();
    this.sync.clear();
    this.pet.load();
    this.sync.sync();
  }

  advanceDay(): void {
    this.clock.advance(1);
    this.sync.sync();
  }

  /** Undoes the fast-forward without reloading the scenario, so the demo's data stays. */
  backToToday(): void {
    this.clock.reset();
    this.sync.sync();
  }

  failNextSync(): void {
    this.wearableApi.failNext = true;
    this.sync.sync();
  }

  /** Wipes everything and starts over at onboarding. A full reload keeps every store honest. */
  async resetAll(): Promise<void> {
    clearAll();
    await skinDb.clear().catch(() => undefined);
    location.assign('/witaj');
  }
}
