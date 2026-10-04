import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { DEFAULT_SETTINGS, PET_COLORS, Settings } from '../models/settings.model';
import { SkinStore } from './skin.store';
import { KEYS, readJson, writeJson } from '../../shared/storage';
import { MOOD_LABEL_MAX_LENGTH, MoodLabels, MoodLevel, moodMeta, MoodMeta, MOODS, withLabels } from '../models/journal.model';
import { DEFAULT_LINES, LINE_MAX_LENGTH, linesFor, pickRandom, SpeechSituation } from '../models/speech.model';

/** Only keys that still exist, so moments and moods of older versions don't linger. */
function pick<T>(stored: Record<string, T> | undefined, keys: readonly (string | number)[]): Record<string, T> {
  return Object.fromEntries(keys.filter((k) => stored?.[k] !== undefined).map((k) => [k, stored![k]]));
}

function load(): Settings {
  const stored = readJson<Partial<Settings>>(KEYS.settings, {});
  const d = DEFAULT_SETTINGS;
  // Field by field, so settings of removed features (goals, body, reminders) don't linger.
  return {
    onboarded: stored.onboarded ?? d.onboarded,
    petName: stored.petName ?? d.petName,
    petColor: stored.petColor ?? d.petColor,
    speech: {
      lines: pick(stored.speech?.lines, Object.keys(DEFAULT_LINES)),
      mixDefaults: stored.speech?.mixDefaults ?? d.speech.mixDefaults,
    },
    moodLabels: pick(stored.moodLabels, MOODS.map((m) => m.level)),
  };
}

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly skins = inject(SkinStore);
  readonly settings = signal<Settings>(load());

  /** Every look is a different Pimpek with a name of its own; petName belongs to the hand-drawn one. */
  readonly petName = computed(() => this.skins.active()?.name ?? (this.settings().petName.trim() || 'Pimpek'));
  readonly petHex = computed(() => PET_COLORS[this.settings().petColor].hex);
  /** Changes only when the lines do, so a picked line stays put while other settings change. */
  readonly speech = computed(() => this.settings().speech);
  /** The moods under the user's own names, best first. */
  readonly moods = computed(() => withLabels(this.settings().moodLabels));

  constructor() {
    effect(() => writeJson(KEYS.settings, this.settings()));
  }

  update(patch: Partial<Settings>): void {
    this.settings.update((s) => ({ ...s, ...patch }));
  }

  /** A random line for this moment: the user's own, or the built-in ones (`defaults` narrows those down). */
  line(situation: SpeechSituation, defaults?: readonly string[]): string {
    return pickRandom(linesFor(this.speech(), situation, defaults));
  }

  /** Returns false for an empty line or one he already knows. */
  addLine(situation: SpeechSituation, text: string): boolean {
    const line = text.trim().slice(0, LINE_MAX_LENGTH);
    const own = this.settings().speech.lines[situation] ?? [];
    if (!line || own.includes(line)) return false;
    this.setLines(situation, [...own, line]);
    return true;
  }

  removeLine(situation: SpeechSituation, index: number): void {
    const own = this.settings().speech.lines[situation] ?? [];
    this.setLines(situation, own.filter((_, i) => i !== index));
  }

  moodMeta(level: MoodLevel): MoodMeta {
    return moodMeta(level, this.moods());
  }

  /** A blank name brings back the default one. */
  setMoodLabel(level: MoodLevel, label: string): void {
    const name = label.trim().slice(0, MOOD_LABEL_MAX_LENGTH);
    this.settings.update((s) => {
      const moodLabels: MoodLabels = { ...s.moodLabels, [level]: name };
      if (!name) delete moodLabels[level];
      return { ...s, moodLabels };
    });
  }

  setMixDefaults(mixDefaults: boolean): void {
    this.settings.update((s) => ({ ...s, speech: { ...s.speech, mixDefaults } }));
  }

  private setLines(situation: SpeechSituation, lines: string[]): void {
    this.settings.update((s) => ({
      ...s,
      speech: { ...s.speech, lines: { ...s.speech.lines, [situation]: lines } },
    }));
  }

  replace(settings: Settings): void {
    this.settings.set(settings);
  }
}
