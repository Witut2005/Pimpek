import { signal } from '@angular/core';
import { AvatarState } from '../../core/models/check-in.model';
import { toDateKey } from '../../shared/date';
import { KEYS, readJson, writeJson } from '../../shared/storage';

/** Rubbing him this far, in px, leaves another dollop of foam. */
const FOAM_EVERY_PX = 34;
const MAX_FOAM = 44;
/** This much foam on him, with the mud gone, and he's ready for the shower. */
const SOAPED_AT = 16;
/** Foam landing this close to a mud spot (in % of his box) scrubs some of it off. */
const SCRUB_REACH = 17;
const SCRUB = 0.26;
/** The soap button drops a handful at once. */
const LATHER = 5;
const RINSE_EVERY_MS = 90;
const POP_MS = 320;
const SHAKE_MS = 1100;
const LINE_MS = 2400;

/** A dollop of foam, in % of his box. */
export interface Foam {
  id: number;
  x: number;
  y: number;
  size: number;
  popped: boolean;
}

/** A mud spot, in % of his box; `left` is how much of it is still there. */
export interface Mud {
  id: number;
  x: number;
  y: number;
  size: number;
  left: number;
}

/** Where he got muddy: on his body, clear of his face and above the rim of the tub. */
const MUD: readonly Omit<Mud, 'left'>[] = [
  { id: 0, x: 21, y: 62, size: 1.05 },
  { id: 1, x: 80, y: 64, size: 0.95 },
  { id: 2, x: 38, y: 24, size: 0.85 },
  { id: 3, x: 67, y: 30, size: 0.7 },
];

/** Where the soap button lands its foam. */
const BODY = { left: 20, right: 80, top: 18, bottom: 66 };

const DIRTY: Record<AvatarState, string> = {
  happy: 'Ubrudziłem się w ogródku! 🙈 Wykąpiesz mnie? Pocieraj mnie palcem 🫧',
  neutral: 'Przydałaby mi się kąpiel 🫧 Pocieraj mnie palcem albo weź mydło',
  sad: 'Ciepła kąpiel… może mi trochę pomoże 🫧',
  sleepy: 'Kąpiel przed snem? Mhm… 😴',
  sick: 'Ciepła kąpiel dobrze mi zrobi 🤒',
};

const CLEAN: Record<AvatarState, string> = {
  happy: 'Już dziś pachnę 🌸 Ale piany nigdy dość! 🫧',
  neutral: 'Jestem czyściutki 🌸 Ale mogę się pluskać 🫧',
  sad: 'Czysty jestem… ale piana zawsze poprawia humor 🫧',
  sleepy: 'Czyściutki… i śpiący 😴',
  sick: 'Czysty… ciepła woda dobrze mi robi 🤒',
};

const DONE: Record<AvatarState, string> = {
  happy: 'Pachnę jak łąka! 🌸 Dzięki!',
  neutral: 'Czyściutki! Dzięki 🌸',
  sad: 'Dziękuję… od razu mi lepiej 💙',
  sleepy: 'Czyściutki… teraz można spać 😴',
  sick: 'Już mi cieplej… dziękuję 💚',
};

export interface BathHooks {
  /** Something to say in the bubble; null hands it back. */
  say(line: string | null): void;
  /** The face he pulls in the tub; null when the bath is over. */
  mood(state: AvatarState | null): void;
  /** All clean: a little celebration. */
  cheer(): void;
}

const bathedToday = () => readJson<string>(KEYS.bath, '') === toDateKey(new Date());

/**
 * Bath time: rub him (or use the soap) until the mud is gone and he's foamy all over, then the
 * shower rinses the foam off from the top down and he shakes himself dry. Plain signals: the
 * template draws the foam and mud, Pimpek's pointer handlers feed in the rubbing.
 */
export class Bath {
  readonly foam = signal<readonly Foam[]>([]);
  readonly mud = signal<readonly Mud[]>([]);
  readonly rinsing = signal(false);
  readonly shaking = signal(false);
  /** Mud gone and foamy all over: time for the shower. */
  readonly soaped = signal(false);

  private nextId = 0;
  private sinceFoam = 0;
  private rinseTimer?: ReturnType<typeof setInterval>;
  private lineTimer?: ReturnType<typeof setTimeout>;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(
    private readonly mood: () => AvatarState,
    private readonly hooks: BathHooks,
  ) {}

  /** What he says in the tub while nothing else is going on. */
  hint(): string {
    if (this.rinsing()) return 'Ciepła woda! 🚿';
    if (this.soaped()) return 'Teraz spłucz mnie prysznicem! 🚿';
    if (this.foam().length) return this.mud().length ? 'Pocieraj, pocieraj! Jeszcze tu i tu 🫧' : 'Więcej piany! 🫧';
    return (this.mud().length ? DIRTY : CLEAN)[this.mood()];
  }

  /** Into the tub: muddy unless he's had his bath today. */
  enter(): void {
    this.leave();
    this.mud.set(bathedToday() ? [] : MUD.map((m) => ({ ...m, left: 1 })));
  }

  leave(): void {
    clearInterval(this.rinseTimer);
    clearTimeout(this.lineTimer);
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.foam.set([]);
    this.mud.set([]);
    this.rinsing.set(false);
    this.shaking.set(false);
    this.soaped.set(false);
    this.sinceFoam = 0;
  }

  /** A finger rubbing him at (x, y), in % of his box, having moved `step` px. */
  scrub(x: number, y: number, step: number): void {
    if (this.rinsing() || this.shaking()) return;
    this.sinceFoam += step;
    if (this.sinceFoam < FOAM_EVERY_PX) return;
    this.sinceFoam = 0;
    this.addFoam(x, y);
    navigator.vibrate?.(8);
  }

  /** The soap button: a handful of foam all over him. */
  lather(): void {
    if (this.rinsing() || this.shaking()) return;
    for (let i = 0; i < LATHER; i++) {
      this.addFoam(
        BODY.left + Math.random() * (BODY.right - BODY.left),
        BODY.top + Math.random() * (BODY.bottom - BODY.top),
      );
    }
    navigator.vibrate?.(15);
  }

  /** The shower runs until the foam is gone, or until it's turned off. */
  toggleRinse(): void {
    if (this.shaking()) return;
    if (this.rinsing()) {
      this.stopRinse();
      return;
    }
    this.rinsing.set(true);
    this.hooks.mood(this.face());
    if (!this.foam().some((f) => !f.popped)) {
      this.say('Brrr! Najpierw mydło 🧼');
      this.later(() => this.stopRinse(), 1200);
      return;
    }
    this.say(this.mood() === 'sleepy' ? 'Mmm… ciepło… 😴' : 'Brrr! Ciepła woda! 🚿');
    this.rinseTimer = setInterval(() => this.rinseStep(), RINSE_EVERY_MS);
  }

  /** The rubber duck. */
  squeak(): void {
    navigator.vibrate?.([10, 30, 10]);
    this.say(this.mood() === 'sick' ? 'Kwa… hihi 🦆' : 'Kwa kwa! 🦆 Hihi! 😆');
  }

  private addFoam(x: number, y: number): void {
    const first = !this.foam().length;
    const jitter = () => (Math.random() * 2 - 1) * 5;
    const dollop: Foam = {
      id: this.nextId++,
      x: Math.min(92, Math.max(8, x + jitter())),
      y: Math.min(90, Math.max(8, y + jitter())),
      size: 0.7 + Math.random() * 0.6,
      popped: false,
    };
    this.foam.update((list) => [...list.slice(-(MAX_FOAM - 1)), dollop]);
    this.mud.update((list) =>
      list
        .map((m) => (Math.hypot(m.x - dollop.x, m.y - dollop.y) < SCRUB_REACH ? { ...m, left: m.left - SCRUB } : m))
        .filter((m) => m.left > 0.05),
    );
    if (first) {
      this.hooks.mood(this.face());
      this.say(this.mood() === 'sleepy' ? 'Mmm… pianka… 😴' : 'Hihi, piana! 🫧');
    }
    if (!this.soaped() && !this.mud().length && this.foam().length >= SOAPED_AT) {
      this.soaped.set(true);
      this.say(null);
    }
  }

  /** Water from above washes off the highest dollop still on him. */
  private rinseStep(): void {
    const top = this.foam()
      .filter((f) => !f.popped)
      .reduce<Foam | undefined>((best, f) => (!best || f.y < best.y ? f : best), undefined);
    if (!top) {
      this.stopRinse();
      if (this.mud().length) this.say('Jeszcze trochę błota… 🙈');
      else this.finish();
      return;
    }
    this.foam.update((list) => list.map((f) => (f.id === top.id ? { ...f, popped: true } : f)));
    this.later(() => this.foam.update((list) => list.filter((f) => f.id !== top.id)), POP_MS);
  }

  private stopRinse(): void {
    clearInterval(this.rinseTimer);
    this.rinsing.set(false);
  }

  /** Clean: he shakes himself dry and that's the bath done for today. */
  private finish(): void {
    this.soaped.set(false);
    this.shaking.set(true);
    this.say('Otrzepuję się! 💦');
    navigator.vibrate?.([20, 60, 20, 60, 20]);
    this.later(() => {
      this.shaking.set(false);
      this.mud.set([]);
      writeJson(KEYS.bath, toDateKey(new Date()));
      this.hooks.cheer();
      this.hooks.mood(null);
      this.say(DONE[this.mood()]);
    }, SHAKE_MS);
  }

  /** Happy in the bath, unless he's too sleepy or poorly to show it; a sad one cheers up once soaped. */
  private face(): AvatarState {
    const mood = this.mood();
    if (mood === 'sleepy' || mood === 'sick') return mood;
    if (mood === 'sad' && !this.soaped()) return 'neutral';
    return 'happy';
  }

  private say(line: string | null): void {
    clearTimeout(this.lineTimer);
    this.hooks.say(line);
    if (line) this.lineTimer = setTimeout(() => this.hooks.say(null), LINE_MS);
  }

  private later(fn: () => void, ms: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, ms);
    this.timers.add(timer);
  }
}
