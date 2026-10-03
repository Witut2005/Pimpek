import { Injectable, signal } from '@angular/core';
import { Scenario } from '../mocks/scenarios';
import { toDateKey } from '../../shared/date';
import { KEYS, readJson, writeJson } from '../../shared/storage';

export interface ScenarioState {
  scenario: Scenario;
  /** Day the scenario was loaded — it gets the scripted headline numbers. */
  anchor: string;
}

@Injectable({ providedIn: 'root' })
export class ScenarioStore {
  readonly state = signal<ScenarioState>(
    readJson(KEYS.scenario, { scenario: 'new', anchor: toDateKey(new Date()) }),
  );

  set(state: ScenarioState): void {
    this.state.set(state);
    writeJson(KEYS.scenario, state);
  }
}
