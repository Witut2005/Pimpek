import { Injectable, signal } from '@angular/core';
import { Scenario } from '../mocks/scenarios';
import { KEYS, readJson, writeJson } from '../../shared/storage';

export interface ScenarioState {
  scenario: Scenario;
}

@Injectable({ providedIn: 'root' })
export class ScenarioStore {
  readonly state = signal<ScenarioState>(readJson(KEYS.scenario, { scenario: 'new' }));

  set(state: ScenarioState): void {
    this.state.set(state);
    writeJson(KEYS.scenario, state);
  }
}
