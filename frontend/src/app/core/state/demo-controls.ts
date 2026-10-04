import { computed, inject, Injectable } from '@angular/core';
import { buildScenarioEntries, Scenario } from '../mocks/scenarios';
import { DEFAULT_SETTINGS } from '../models/settings.model';
import { ClockStore } from './clock.store';
import { JournalStore } from './journal.store';
import { ScenarioStore } from './scenario.store';
import { SettingsStore } from './settings.store';
import { toDateKey } from '../../shared/date';
import { skinDb } from '../../shared/skin-db';
import { clearAll } from '../../shared/storage';

/** The jury remote: load a story, fast-forward a day. */
@Injectable({ providedIn: 'root' })
export class DemoControls {
  private readonly scenarioStore = inject(ScenarioStore);
  private readonly settings = inject(SettingsStore);
  private readonly journal = inject(JournalStore);
  private readonly clock = inject(ClockStore);

  readonly scenario = computed(() => this.scenarioStore.state().scenario);
  readonly dayOffset = this.clock.offsetDays;

  load(scenario: Scenario): void {
    const current = this.settings.settings();
    this.clock.reset();
    this.scenarioStore.set({ scenario });
    this.settings.replace({
      ...DEFAULT_SETTINGS,
      petName: current.petName,
      petColor: current.petColor,
      onboarded: true,
      reminders: { ...DEFAULT_SETTINGS.reminders, asked: scenario !== 'new' },
    });
    this.journal.replace(buildScenarioEntries(scenario, toDateKey(new Date())));
  }

  advanceDay(): void {
    this.clock.advance(1);
  }

  /** Undoes the fast-forward without reloading the scenario, so the demo's data stays. */
  backToToday(): void {
    this.clock.reset();
  }

  /** Wipes everything and starts over at onboarding. A full reload keeps every store honest. */
  async resetAll(): Promise<void> {
    clearAll();
    await skinDb.clear().catch(() => undefined);
    location.assign('/witaj');
  }
}
