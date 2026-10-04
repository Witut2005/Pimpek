import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AvatarState } from '../../core/models/check-in.model';
import { HUGS, THANKS } from '../../core/models/speech.model';
import { SettingsStore } from '../../core/state/settings.store';
import { Icon } from '../../shared/icon/icon';
import { Bath } from './bath';
import { Gaze } from './gaze';
import { PimpekAvatar } from './pimpek-avatar';
import { PimpekCups } from './pimpek-cups';
import { PimpekTub } from './pimpek-tub';
import { Playground } from './play';
import { Game, GAME_HINTS, GAMES, Room } from './rooms';

/** Past this distance from his eyes the gaze is at full stretch. */
const GAZE_RANGE_PX = 260;
/** No pointer movement for this long and he goes back to looking around on his own. */
const GAZE_IDLE_MS = 2500;
/** Finger, pen or pressed mouse: this much stroking counts as petting. A plain hovering mouse only draws his gaze. */
const PET_PX = 110;
/** A pause longer than this starts a new stroke. */
const STROKE_GAP_MS = 400;
/** Moving further than this between press and release is a drag, not a tap. */
const TAP_SLOP_PX = 12;
const HEART_EVERY_PX = 70;
const MAX_HEARTS = 10;
const HEART_LIFE_MS = 1300;
/** He stays blissful a moment after the stroking stops. */
const PET_LINGER_MS = 900;
/** Stroked this long without a break, he melts into a happy puddle. */
const MELT_AFTER_MS = 4000;
/** This many changes of direction this quickly, finger down, is tickling rather than stroking. */
const TICKLE_FLIPS = 4;
const TICKLE_WINDOW_MS = 700;
const TICKLE_LINGER_MS = 900;
const PANT_MS = 1600;
/** Holding a finger still on him this long is a hug. */
const HUG_HOLD_MS = 550;
const HUG_BEAT_MS = 1100;
/** A hug held this long turns into breathing together: 4 s in, 6 s out. */
const BREATHE_AFTER_MS = 3000;
const BREATH_MS = 10_000;
const INHALE_MS = 4000;
const SIGH_MS = 1600;
const THANKS_MS = 2600;
const CHEER_MS = 1800;

const HEARTS = ['💗', '💛', '🧡', '💙'];
/** Drops flung off him as he shakes himself dry after the bath. */
const SPLASHES = [0, 45, 90, 135, 180, 225, 270, 315];

/** Being hugged, and whether the hug has turned into breathing together. */
export type Cuddle = 'hug' | 'breathe';

interface Stroke {
  x: number;
  y: number;
  distance: number;
  sinceHeart: number;
  dirX: number;
  dirY: number;
  /** When the recent changes of direction happened, to tell tickling from stroking. */
  flips: number[];
  at: number;
}

interface Heart {
  id: number;
  x: number;
  y: number;
  icon: string;
}

function newStroke(x: number, y: number): Stroke {
  return { x, y, distance: 0, sinceHeart: 0, dirX: 0, dirY: 0, flips: [], at: performance.now() };
}

/** Which way his eyes turn to look at a point on screen. */
function gazeAt(eyes: DOMRect, x: number, y: number): Gaze {
  // His eyes sit right in the middle of the avatar box.
  const dx = x - (eyes.left + eyes.width / 2);
  const dy = y - (eyes.top + eyes.height / 2);
  const distance = Math.hypot(dx, dy) || 1;
  const reach = Math.min(1, distance / GAZE_RANGE_PX);
  return { x: (dx / distance) * reach, y: (dy / distance) * reach };
}

/**
 * Pimpek on stage, in whichever room he's in: speech bubble and tap target around the avatar,
 * plus the room's things — the tub in the bathroom, the ball or the cups in the playroom.
 * His eyes follow the pointer; he purrs when stroked, giggles when tickled and hugs back when
 * held — in the tub, rubbing him soaps him instead. Pointer listeners are native, so moving the
 * mouse never runs change detection — only the signals they set do.
 */
@Component({
  selector: 'app-pimpek',
  imports: [PimpekAvatar, PimpekCups, PimpekTub, Icon],
  templateUrl: './pimpek.html',
  styleUrl: './pimpek.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.in-bath]': "room() === 'bath'",
    '[class.in-play]': "room() === 'play'",
  },
})
export class Pimpek {
  readonly state = input.required<AvatarState>();
  readonly message = input.required<string>();
  readonly celebrating = input(false);
  readonly color = input<string>();
  /** Pimpek is waiting for today's check-in. */
  readonly needsAttention = input(false);
  readonly room = input<Room>('home');

  /** A hug started, turned into breathing, or ended (null) — the room warms up meanwhile. */
  readonly cuddle = output<Cuddle | null>();

  private readonly settings = inject(SettingsStore);
  private readonly pet = viewChild.required<ElementRef<HTMLButtonElement>>('pet');
  private readonly mover = viewChild.required<ElementRef<HTMLElement>>('mover');
  // Only in the playroom with the ball out.
  private readonly rug = viewChild<ElementRef<HTMLElement>>('rug');
  private readonly field = viewChild<ElementRef<HTMLElement>>('field');
  private readonly ball = viewChild<ElementRef<HTMLElement>>('ball');
  private readonly ballSkin = viewChild<ElementRef<HTMLElement>>('ballSkin');
  private readonly ballShadow = viewChild<ElementRef<HTMLElement>>('ballShadow');

  protected readonly games = GAMES;
  protected readonly splashes = SPLASHES;
  protected readonly game = signal<Game>('ball');
  protected readonly bath = new Bath(() => this.state(), {
    say: (line) => this.gameLine.set(line),
    mood: (state) => this.gameMood.set(state),
    cheer: () => this.cheer(),
  });

  private readonly gaze = signal<Gaze | null>(null);
  protected readonly petting = signal(false);
  protected readonly melted = signal(false);
  protected readonly tickling = signal(false);
  protected readonly panting = signal(false);
  protected readonly hug = signal<Cuddle | null>(null);
  protected readonly sighing = signal(false);
  /** Where the stroking finger is across him, -1 (left) to 1: he leans into the hand. */
  protected readonly lean = signal(0);
  protected readonly hearts = signal<Heart[]>([]);
  private readonly purr = signal('');
  /** Giggles, hugs and their afterglow; wins over everything else in the bubble. */
  private readonly line = signal<string | null>(null);
  /** What the game going on in this room (ball, cups or bath) has him say, the face and where he looks. */
  protected readonly gameLine = signal<string | null>(null);
  protected readonly gameMood = signal<AvatarState | null>(null);
  private readonly gameGaze = signal<Gaze | null>(null);
  /** A game won or a bath done. */
  private readonly cheering = signal(false);

  /** Stroked, tickled or hugged he's happy whatever his mood; playing has its own face. */
  protected readonly shownState = computed<AvatarState>(() =>
    this.petting() || this.tickling() || this.hug() ? 'happy' : (this.gameMood() ?? this.state()),
  );
  /** Away from his room he talks about the room's game rather than the journal. */
  private readonly roomLine = computed(() => {
    const room = this.room();
    if (room === 'bath') return this.bath.hint();
    if (room === 'play') return GAME_HINTS[this.game()][this.state()];
    return this.message();
  });
  protected readonly shownMessage = computed(
    () => this.line() ?? (this.petting() ? this.purr() : null) ?? this.gameLine() ?? this.roomLine(),
  );
  /** While playing he watches the ball or the cups, not the pointer. */
  protected readonly shownGaze = computed(() => this.gameGaze() ?? this.gaze());
  protected readonly shownCelebrating = computed(() => this.celebrating() || this.cheering());

  private stroke?: Stroke;
  private pressAt?: { x: number; y: number };
  private nextHeart = 0;
  private pettingSince = 0;
  private lastGiggleBuzz = 0;
  private gazeTimer?: ReturnType<typeof setTimeout>;
  private petTimer?: ReturnType<typeof setTimeout>;
  private tickleTimer?: ReturnType<typeof setTimeout>;
  private lineTimer?: ReturnType<typeof setTimeout>;
  private hugTimer?: ReturnType<typeof setTimeout>;
  private breatheTimer?: ReturnType<typeof setTimeout>;
  private exhaleTimer?: ReturnType<typeof setTimeout>;
  private sighTimer?: ReturnType<typeof setTimeout>;
  private beatTimer?: ReturnType<typeof setInterval>;
  private cheerTimer?: ReturnType<typeof setTimeout>;
  private frame = 0;
  private play?: Playground;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // A new room or game starts with a clean slate: no leftover lines, faces or gaze.
    effect((onCleanup) => {
      const room = this.room();
      this.game();
      untracked(() => {
        this.gameLine.set(null);
        this.gameMood.set(null);
        this.gameGaze.set(null);
        if (room === 'bath') this.bath.enter();
      });
      onCleanup(() => this.bath.leave());
    });

    // The ball is on the rug only in the playroom; the game comes and goes with it.
    // It works with reduced motion too: a tap is a quick catch instead of a throw.
    effect((onCleanup) => {
      const [field, ball, skin, shadow, rug] = [this.field(), this.ball(), this.ballSkin(), this.ballShadow(), this.rug()];
      if (!field || !ball || !skin || !shadow || !rug) return;
      const play = untracked(
        () =>
          new Playground(
            {
              field: field.nativeElement,
              ball: ball.nativeElement,
              skin: skin.nativeElement,
              shadow: shadow.nativeElement,
              mover: this.mover().nativeElement,
              rug: rug.nativeElement,
            },
            () => this.state(),
            {
              say: (line) => this.gameLine.set(line),
              mood: (state) => this.gameMood.set(state),
              look: (gaze) => this.gameGaze.set(gaze),
            },
          ),
      );
      this.play = play;
      onCleanup(() => {
        play.destroy();
        this.play = undefined;
      });
    });

    destroyRef.onDestroy(() => clearTimeout(this.cheerTimer));

    afterNextRender(() => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const pet = this.pet().nativeElement;
      const track = (e: PointerEvent) => this.track(e);
      const stroke = (e: PointerEvent) => this.onStroke(e);
      // The stroke starts where the finger lands, so even one fast swipe counts.
      const press = (e: PointerEvent) => {
        this.pressAt = { x: e.clientX, y: e.clientY };
        this.stroke = newStroke(e.clientX, e.clientY);
        clearTimeout(this.hugTimer);
        // No hugs in the tub: holding him there is just soaping.
        if (e.button === 0 && this.room() !== 'bath') this.hugTimer = setTimeout(() => this.startHug(), HUG_HOLD_MS);
      };
      const release = () => {
        clearTimeout(this.hugTimer);
        if (this.hug()) this.endHug();
      };
      // A long press is a hug, not the phone's context menu.
      const noMenu = (e: Event) => e.preventDefault();
      document.addEventListener('pointermove', track, { passive: true });
      document.addEventListener('pointerdown', track, { passive: true });
      document.addEventListener('pointerup', release);
      document.addEventListener('pointercancel', release);
      pet.addEventListener('pointermove', stroke, { passive: true });
      pet.addEventListener('pointerdown', press, { passive: true });
      pet.addEventListener('contextmenu', noMenu);
      destroyRef.onDestroy(() => {
        document.removeEventListener('pointermove', track);
        document.removeEventListener('pointerdown', track);
        document.removeEventListener('pointerup', release);
        document.removeEventListener('pointercancel', release);
        pet.removeEventListener('pointermove', stroke);
        pet.removeEventListener('pointerdown', press);
        pet.removeEventListener('contextmenu', noMenu);
        cancelAnimationFrame(this.frame);
        [this.gazeTimer, this.petTimer, this.tickleTimer, this.lineTimer, this.hugTimer].forEach(clearTimeout);
        [this.breatheTimer, this.exhaleTimer, this.sighTimer].forEach(clearTimeout);
        clearInterval(this.beatTimer);
      });
    });
  }

  protected setGame(game: Game): void {
    this.game.set(game);
  }

  /** The cups game points his eyes at a cup; null hands them back to the pointer. */
  protected lookAt(point: { x: number; y: number } | null): void {
    this.gameGaze.set(point && gazeAt(this.pet().nativeElement.getBoundingClientRect(), point.x, point.y));
  }

  protected cheer(): void {
    this.cheering.set(true);
    clearTimeout(this.cheerTimer);
    this.cheerTimer = setTimeout(() => this.cheering.set(false), CHEER_MS);
  }

  /** Points the eyes at the pointer, once per frame. */
  private track(e: PointerEvent): void {
    const { clientX, clientY } = e;
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      this.gaze.set(gazeAt(this.pet().nativeElement.getBoundingClientRect(), clientX, clientY));
    });
    clearTimeout(this.gazeTimer);
    this.gazeTimer = setTimeout(() => this.gaze.set(null), GAZE_IDLE_MS);
  }

  private onStroke(e: PointerEvent): void {
    // Hugging: a finger shifting a little doesn't turn it into stroking.
    if (this.hug()) return;
    // Only a pressed pointer strokes him; a mouse merely passing over just catches his eye.
    if (e.buttons === 0) {
      this.stroke = undefined;
      return;
    }
    if (this.pressAt && Math.hypot(e.clientX - this.pressAt.x, e.clientY - this.pressAt.y) > TAP_SLOP_PX) {
      clearTimeout(this.hugTimer);
    }
    const now = performance.now();
    const s = this.stroke;
    if (!s) {
      this.stroke = newStroke(e.clientX, e.clientY);
      return;
    }
    // After a pause the count starts over, but this movement (from where the pointer rested) still counts.
    if (now - s.at > STROKE_GAP_MS) {
      Object.assign(s, { distance: 0, sinceHeart: 0, dirX: 0, dirY: 0, flips: [] });
    }
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const step = Math.hypot(dx, dy);
    if (step < 2) return;

    // Back-and-forth along either axis, quick enough, is tickling.
    const dirX = Math.abs(dx) > 3 ? Math.sign(dx) : 0;
    const dirY = Math.abs(dy) > 3 ? Math.sign(dy) : 0;
    if ((dirX && s.dirX && dirX !== s.dirX) || (dirY && s.dirY && dirY !== s.dirY)) {
      s.flips.push(now);
    }
    s.dirX = dirX || s.dirX;
    s.dirY = dirY || s.dirY;
    s.distance += step;
    s.sinceHeart += step;
    s.x = e.clientX;
    s.y = e.clientY;
    s.at = now;

    if (this.room() === 'bath') {
      const rect = this.pet().nativeElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      this.bath.scrub(x, y, step);
    } else if (s.distance > PET_PX) {
      this.petted(e, s, now);
    }
  }

  private petted(e: PointerEvent, s: Stroke, now: number): void {
    if (!this.petting()) {
      this.purr.set(this.settings.line('petted'));
      this.petting.set(true);
      this.pettingSince = now;
      this.play?.calm();
      if (!this.tickling()) this.say(null);
    }

    s.flips = s.flips.filter((t) => now - t < TICKLE_WINDOW_MS);
    if (s.flips.length >= TICKLE_FLIPS) {
      this.tickled(now);
    } else if (!this.tickling() && !this.melted() && now - this.pettingSince > MELT_AFTER_MS) {
      this.melted.set(true);
      this.purr.set(this.state() === 'sleepy' ? 'Zzz… mrrr… 😴' : 'Mrrr… rozpływam się… 🫠');
    }

    const rect = this.pet().nativeElement.getBoundingClientRect();
    const across = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    this.lean.set(Math.round(Math.max(-1, Math.min(1, across)) * 20) / 20);

    if (this.tickling()) {
      s.sinceHeart = 0;
    } else if (s.sinceHeart >= HEART_EVERY_PX) {
      s.sinceHeart = 0;
      this.addHeart(e);
      navigator.vibrate?.(12);
    }
    clearTimeout(this.petTimer);
    this.petTimer = setTimeout(() => {
      this.petting.set(false);
      this.melted.set(false);
    }, PET_LINGER_MS);
  }

  /** Giggles and wriggles while it lasts, then catches his breath. */
  private tickled(now: number): void {
    if (!this.tickling()) {
      this.tickling.set(true);
      this.melted.set(false);
      this.panting.set(false);
      this.say(this.settings.line('tickled'));
    }
    if (now - this.lastGiggleBuzz > 250) {
      this.lastGiggleBuzz = now;
      navigator.vibrate?.([8, 40, 8]);
    }
    clearTimeout(this.tickleTimer);
    this.tickleTimer = setTimeout(() => {
      this.tickling.set(false);
      this.panting.set(true);
      this.say('Uff… hihi… jeszcze raz? 😆', PANT_MS);
      this.tickleTimer = setTimeout(() => this.panting.set(false), PANT_MS);
    }, TICKLE_LINGER_MS);
  }

  /** Squeezes in with a heartbeat; held longer, he breathes slowly with you. */
  private startHug(): void {
    this.play?.calm();
    clearTimeout(this.sighTimer);
    this.sighing.set(false);
    this.setHug('hug');
    this.say(this.settings.line('hugged', [HUGS[this.state()]]));
    const beat = () => navigator.vibrate?.([30, 120, 30]);
    beat();
    this.beatTimer = setInterval(beat, HUG_BEAT_MS);
    this.breatheTimer = setTimeout(() => this.startBreathing(), BREATHE_AFTER_MS);
  }

  private startBreathing(): void {
    clearInterval(this.beatTimer);
    this.setHug('breathe');
    // The .breathing animation starts with the class, so the first inhale lines up with it.
    const cycle = () => {
      this.say('Wdech… 🌬️');
      navigator.vibrate?.(20);
      this.exhaleTimer = setTimeout(() => this.say('Wydech… 🍃'), INHALE_MS);
    };
    cycle();
    this.beatTimer = setInterval(cycle, BREATH_MS);
  }

  private endHug(): void {
    clearInterval(this.beatTimer);
    clearTimeout(this.breatheTimer);
    clearTimeout(this.exhaleTimer);
    this.setHug(null);
    this.sighing.set(true);
    this.sighTimer = setTimeout(() => this.sighing.set(false), SIGH_MS);
    this.say(this.settings.line('thanks', [THANKS[this.state()]]), THANKS_MS);
  }

  private setHug(cuddle: Cuddle | null): void {
    this.hug.set(cuddle);
    this.cuddle.emit(cuddle);
  }

  private say(line: string | null, ms?: number): void {
    clearTimeout(this.lineTimer);
    this.line.set(line);
    if (line && ms) this.lineTimer = setTimeout(() => this.line.set(null), ms);
  }

  private addHeart(e: PointerEvent): void {
    const rect = this.pet().nativeElement.getBoundingClientRect();
    const heart: Heart = {
      id: this.nextHeart++,
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
      icon: HEARTS[this.nextHeart % HEARTS.length],
    };
    this.hearts.update((list) => [...list.slice(-(MAX_HEARTS - 1)), heart]);
    setTimeout(() => this.hearts.update((list) => list.filter((h) => h.id !== heart.id)), HEART_LIFE_MS);
  }
}
