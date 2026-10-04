import { AvatarState } from '../../core/models/check-in.model';
import { Gaze } from './gaze';

// Distances and speeds are in Pimpek's widths, so the game plays the same on a phone and a monitor.
const GRAVITY = 6.5;
const MAX_THROW = 9;
const FLOOR_BOUNCE = 0.5;
const WALL_BOUNCE = 0.7;
/** A bounce on the floor slower than this turns into rolling. */
const MIN_BOUNCE = 0.9;
const ROLL_DRAG = 1.8;
const JUMP_HEIGHT = 0.22;
/** Crouch, flight and landing of one jump, in ms from take-off. */
const JUMP_CROUCH = 100;
const JUMP_LAND = 460;
const JUMP_MS = 620;
/** He takes off this long before the ball reaches the top of his jump. */
const JUMP_LEAD_S = 0.28;
const TAP_SLOP_PX = 12;
const VELOCITY_WINDOW_MS = 90;
const RETURN_MS = 900;
const FETCH_TIMEOUT_MS = 1600;
/** With the ball back on the rug and nobody throwing it for this long, the game is over. */
const GAME_OVER_MS = 5000;
const LINE_MS = 1800;
/** Each header in a row makes the next jump this much less likely, so rallies end and you throw again. */
const TIRING = 0.8;
const GAZE_RANGE_PX = 260;

/** How each mood plays: walking speed (widths per second) and the odds he jumps for a ball. */
const STYLES: Record<AvatarState, { speed: number; jumps: number }> = {
  happy: { speed: 2.4, jumps: 1 },
  neutral: { speed: 1.9, jumps: 0.9 },
  sad: { speed: 1.2, jumps: 0.8 },
  sleepy: { speed: 0.7, jumps: 0.45 },
  sick: { speed: 0, jumps: 0 },
};

const GRAB_LINES: Record<AvatarState, string> = {
  happy: 'Rzuć! Rzuć! 🎾',
  neutral: 'Rzucaj, łapię! 🎾',
  sad: 'Mhm… 😔',
  sleepy: 'Mhm… rzucaj… 😴',
  sick: 'Nie dziś… źle się czuję 🤒',
};

type BallMode = 'rest' | 'held' | 'flying' | 'rolling' | 'returning';

export interface PlayElements {
  /** Zero-sized anchor in the middle of the rug: the origin of the game's coordinates. */
  field: HTMLElement;
  ball: HTMLElement;
  /** The rolling felt inside the ball; the highlight on top stays put. */
  skin: HTMLElement;
  shadow: HTMLElement;
  /** Wraps Pimpek; walking and jumping move this. */
  mover: HTMLElement;
  rug: HTMLElement;
}

export interface PlayHooks {
  /** Something to say in the bubble; null hands it back. */
  say(line: string | null): void;
  /** The face he pulls while playing; null when the game is over. */
  mood(state: AvatarState | null): void;
  /** Where the ball is relative to his eyes; null when he stops watching it. */
  look(gaze: Gaze | null): void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

function hitsWord(n: number): string {
  if (n === 1) return 'odbicie';
  const tens = n % 100;
  return n % 10 >= 2 && n % 10 <= 4 && (tens < 12 || tens > 14) ? 'odbicia' : 'odbić';
}

/**
 * The ball on the rug: throw it and Pimpek runs under it and heads it back. Plain DOM and
 * requestAnimationFrame — every frame writes transforms straight to the elements, and only
 * lines, faces and gaze go back to Angular through the hooks.
 *
 * Coordinates are px from the middle of the rug, y growing downwards.
 */
export class Playground {
  private w = 0;
  private h = 0;
  private r = 0;
  private box = { left: 0, minX: 0, maxX: 0, minY: 0, floor: 0, range: 0, restX: 0, head: 0, eyes: 0 };

  private x = 0;
  private y = 0;
  private vx = 0;
  private vy = 0;
  private spin = 0;
  private mode: BallMode = 'rest';
  /** Thrown or headed and not yet on the floor: touching it now is a miss. */
  private live = false;
  /** Whether he goes for the ball on this descent; decided once per throw or header. */
  private willJump: boolean | null = null;
  /** A sad or sick Pimpek lets this throw go by. */
  private ignoring = false;
  /** Bonked on the head: he stops chasing this ball until it's thrown or headed again. */
  private dazed = false;
  private returnFrom?: { x: number; at: number };
  private fetchUntil?: number;

  private petX = 0;
  private target = 0;
  private hop = 0;
  private lift = 0;
  private sx = 1;
  private sy = 1;
  private jumpAt?: number;
  private wobbleAt?: number;

  private active = false;
  private streak = 0;
  private best = 0;
  private total = 0;
  private ignored = 0;
  private frame = 0;
  private last = 0;
  private lastGaze?: Gaze;
  private samples: { x: number; y: number; t: number }[] = [];
  private grab = { dx: 0, dy: 0, x: 0, y: 0 };
  private overTimer?: ReturnType<typeof setTimeout>;
  private lineTimer?: ReturnType<typeof setTimeout>;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly cleanup: (() => void)[] = [];

  constructor(
    private readonly els: PlayElements,
    private readonly mood: () => AvatarState,
    private readonly hooks: PlayHooks,
  ) {
    const { ball, mover } = els;
    const listen = <K extends keyof HTMLElementEventMap>(
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
    ) => {
      ball.addEventListener(type, fn);
      this.cleanup.push(() => ball.removeEventListener(type, fn));
    };
    listen('pointerdown', (e) => this.onDown(e));
    listen('pointermove', (e) => this.onMove(e));
    listen('pointerup', (e) => this.onUp(e));
    listen('pointercancel', (e) => this.onUp(e));
    listen('click', (e) => this.onClick(e));

    // Pimpek grows and shrinks with the window; the ball keeps its spot relative to him.
    const resize = new ResizeObserver(() => {
      this.measure();
      this.render();
    });
    resize.observe(mover);
    this.cleanup.push(() => resize.disconnect());

    this.measure();
    this.render();
  }

  /** Petted or hugged mid-game: he forgets the ball, which drops and rolls back by itself. */
  calm(): void {
    if (!this.active) return;
    this.ignoring = true;
    this.willJump = false;
    this.fetchUntil = undefined;
    this.target = this.petX;
    if (this.mode === 'returning' && this.returnFrom?.at === Infinity) this.returnFrom = { x: this.x, at: performance.now() };
  }

  /** Also when he leaves the playroom mid-game: he's put back where he stood. */
  destroy(): void {
    cancelAnimationFrame(this.frame);
    clearTimeout(this.overTimer);
    clearTimeout(this.lineTimer);
    this.cleanup.forEach((fn) => fn());
    this.els.mover.style.transform = '';
  }

  private measure(): void {
    const { mover, rug, ball, field } = this.els;
    this.w = mover.offsetWidth;
    this.h = mover.offsetHeight;
    this.r = ball.offsetWidth / 2;
    const { w, h, r } = this;
    // Pimpek's feet sit a little below the middle of the rug.
    const feet = mover.offsetTop + h - (rug.offsetTop + rug.offsetHeight / 2);
    const { left, top } = field.getBoundingClientRect();
    const minX = Math.max(left - w, 8) - left + r;
    const maxX = Math.min(left + w, innerWidth - 8) - left - r;
    this.box = {
      left,
      minX,
      maxX,
      // The top of the screen is the ceiling.
      minY: 8 - top + r,
      floor: -0.8 * r,
      // How far he may walk, keeping his whole body on screen.
      range: Math.max(0, Math.min(-minX, maxX) + r - 0.4 * w),
      restX: 0.5 * w,
      // From the drawing: the top of his head and his eyes, as a share of his height.
      head: feet - 0.76 * h,
      eyes: feet - 0.5 * h,
    };
    if (this.mode === 'rest') {
      this.x = this.box.restX;
      this.y = this.box.floor;
    }
  }

  // ---- input ----

  private point(e: PointerEvent): { x: number; y: number } {
    const { left, top } = this.els.field.getBoundingClientRect();
    return { x: e.clientX - left, y: e.clientY - top };
  }

  private onDown(e: PointerEvent): void {
    if (this.reduced || e.button > 0) return;
    // No text selection while dragging the ball around.
    e.preventDefault();
    this.els.ball.setPointerCapture(e.pointerId);
    this.measure();
    this.start();
    this.mode = 'held';
    this.live = false;
    this.returnFrom = undefined;
    this.fetchUntil = undefined;
    const p = this.point(e);
    this.grab = { dx: p.x - this.x, dy: p.y - this.y, x: p.x, y: p.y };
    this.samples = [{ ...p, t: e.timeStamp }];
    this.say(GRAB_LINES[this.mood()]);
  }

  private onMove(e: PointerEvent): void {
    if (this.mode !== 'held') return;
    const p = this.point(e);
    const b = this.box;
    this.x = clamp(p.x - this.grab.dx, b.minX, b.maxX);
    this.y = clamp(p.y - this.grab.dy, b.minY, b.floor);
    this.samples.push({ x: this.x, y: this.y, t: e.timeStamp });
    this.samples = this.samples.filter((s, i, all) => i >= all.length - 2 || e.timeStamp - s.t < VELOCITY_WINDOW_MS);
  }

  private onUp(e: PointerEvent): void {
    if (this.mode !== 'held') return;
    const p = this.point(e);
    if (Math.hypot(p.x - this.grab.x, p.y - this.grab.y) < TAP_SLOP_PX) {
      this.toss();
      return;
    }
    // Throw speed is how fast the finger moved just before letting go.
    const recent = this.samples.filter((s) => e.timeStamp - s.t < VELOCITY_WINDOW_MS);
    let vx = 0;
    let vy = 0;
    if (recent.length >= 2) {
      const first = recent[0];
      const last = recent[recent.length - 1];
      const dt = (last.t - first.t) / 1000;
      if (dt > 0.008) {
        vx = (last.x - first.x) / dt;
        vy = (last.y - first.y) / dt;
      }
    }
    const speed = Math.hypot(vx, vy);
    const max = MAX_THROW * this.w;
    if (speed > max) {
      vx *= max / speed;
      vy *= max / speed;
    }
    this.launch(vx, vy);
  }

  /** Keyboard: Enter or Space tosses the ball. With reduced motion any tap is a quick catch. */
  private onClick(e: MouseEvent): void {
    if (this.reduced) {
      this.hooks.mood('happy');
      this.say('Złapałem! 🎾');
      clearTimeout(this.overTimer);
      this.overTimer = setTimeout(() => this.hooks.mood(null), LINE_MS);
      return;
    }
    if (e.detail !== 0) return;
    this.measure();
    this.start();
    this.toss();
  }

  // ---- the game ----

  private start(): void {
    clearTimeout(this.overTimer);
    if (this.active) return;
    this.active = true;
    this.streak = 0;
    this.total = 0;
    this.ignored = 0;
    this.hooks.mood(this.face());
    this.last = performance.now();
    this.frame = requestAnimationFrame((now) => this.loop(now));
  }

  private finish(): void {
    if (this.mode !== 'rest') return;
    this.active = false;
    cancelAnimationFrame(this.frame);
    this.petX = this.target = 0;
    this.render();
    this.lastGaze = undefined;
    this.hooks.look(null);
    this.hooks.mood(null);
    this.say(this.best >= 5 ? 'Uff, ale się zmęczyłem 😅' : null, 2500);
    this.best = 0;
  }

  /** A soft lob from wherever the ball is to just above Pimpek's head. */
  private toss(): void {
    const { vx, vy } = this.aim(this.petX, this.box.head - 0.9 * this.w);
    this.launch(vx, vy);
  }

  private launch(vx: number, vy: number): void {
    this.vx = vx;
    this.vy = vy;
    this.mode = 'flying';
    this.live = true;
    this.willJump = null;
    this.ignoring = false;
    this.dazed = false;
    const mood = this.mood();
    if (mood === 'sick') {
      this.ignoring = true;
      this.say(GRAB_LINES.sick, LINE_MS);
    } else if (mood === 'sad' && this.total === 0 && this.ignored < 2) {
      // Too low to play at first; the third throw gets him going.
      this.ignoring = true;
      this.ignored++;
      this.say(this.ignored === 1 ? 'Nie mam dziś siły… 😔' : 'No… może jeszcze raz? 😔', LINE_MS);
    } else {
      this.say(null);
    }
  }

  /** Velocity that sends the ball up to apexY and down onto targetX at the height he heads it. */
  private aim(targetX: number, apexY: number): { vx: number; vy: number } {
    const g = GRAVITY * this.w;
    const vy = -Math.sqrt(2 * g * Math.max(this.y - apexY, 1));
    const fall = Math.max(this.contactY() - apexY, 1);
    const t = -vy / g + Math.sqrt((2 * fall) / g);
    return { vx: (targetX - this.x) / t, vy };
  }

  /** Where the ball's centre is when it meets his head at the top of a jump. */
  private contactY(): number {
    return this.box.head - JUMP_HEIGHT * this.w - 0.7 * this.r;
  }

  private style(): { speed: number; jumps: number } {
    const mood = this.mood();
    // A sad Pimpek perks up once he's played a little.
    return STYLES[mood === 'sad' && this.total > 0 ? 'neutral' : mood];
  }

  /** Happy and neutral play happily; sad brightens with every header; sleepy and sick stay so. */
  private face(): AvatarState {
    const mood = this.mood();
    if (mood === 'sad') return this.total >= 3 ? 'happy' : this.total >= 1 ? 'neutral' : 'sad';
    return mood === 'neutral' ? 'happy' : mood;
  }

  private say(line: string | null, ms?: number): void {
    clearTimeout(this.lineTimer);
    this.hooks.say(line);
    if (line && ms) this.lineTimer = setTimeout(() => this.hooks.say(null), ms);
  }

  // ---- every frame ----

  private loop(now: number): void {
    const dt = Math.min((now - this.last) / 1000, 1 / 30);
    this.last = now;
    this.pose(now);
    this.moveBall(dt, now);
    this.think(now);
    this.walk(dt);
    this.look();
    this.render();
    if (this.active) this.frame = requestAnimationFrame((t) => this.loop(t));
  }

  /** Jump and wobble: how high he is and how squashed. */
  private pose(now: number): void {
    const w = this.w;
    let lift = 0;
    let sx = 1;
    let sy = 1;
    if (this.jumpAt !== undefined) {
      const t = now - this.jumpAt;
      if (t < JUMP_CROUCH) {
        const k = t / JUMP_CROUCH;
        sx = 1 + 0.12 * k;
        sy = 1 - 0.14 * k;
      } else if (t < JUMP_LAND) {
        const k = (t - JUMP_CROUCH) / (JUMP_LAND - JUMP_CROUCH);
        lift = JUMP_HEIGHT * w * Math.sin(Math.PI * k);
        sx = 0.94;
        sy = 1.08;
      } else if (t < JUMP_MS) {
        const s = Math.sin((Math.PI * (t - JUMP_LAND)) / (JUMP_MS - JUMP_LAND));
        sx = 1 + 0.1 * s;
        sy = 1 - 0.12 * s;
      } else {
        this.jumpAt = undefined;
        this.wobbleAt = now;
      }
    }
    if (this.wobbleAt !== undefined) {
      // A jelly settle: a quick squash and stretch that dies out.
      const t = (now - this.wobbleAt) / 1000;
      if (t > 0.9) {
        this.wobbleAt = undefined;
      } else {
        const s = 0.07 * Math.exp(-5 * t) * Math.sin(20 * t);
        sx *= 1 + s;
        sy *= 1 - s;
      }
    }
    this.lift = lift;
    this.sx = sx;
    this.sy = sy;
  }

  private airborne(now: number): boolean {
    if (this.jumpAt === undefined) return false;
    const t = now - this.jumpAt;
    return t >= JUMP_CROUCH && t < JUMP_LAND;
  }

  private moveBall(dt: number, now: number): void {
    const b = this.box;
    const w = this.w;
    if (this.mode === 'flying') {
      const prevY = this.y;
      this.vy += GRAVITY * w * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.walls();
      this.hitPimpek(prevY, now);
      if (this.y >= b.floor) {
        this.y = b.floor;
        if (this.live) this.missed();
        if (this.vy > MIN_BOUNCE * w) {
          this.vy *= -FLOOR_BOUNCE;
        } else {
          this.vy = 0;
          this.mode = 'rolling';
        }
      }
      this.spin += (this.vx * dt) / this.r;
    } else if (this.mode === 'rolling') {
      this.vx *= Math.exp(-ROLL_DRAG * dt);
      this.x += this.vx * dt;
      this.walls();
      this.spin += (this.vx * dt) / this.r;
      if (Math.abs(this.vx) < 0.05 * w) this.stopped(now);
    } else if (this.mode === 'returning' && this.returnFrom) {
      const t = clamp((now - this.returnFrom.at) / RETURN_MS, 0, 1);
      const x = this.returnFrom.x + (b.restX - this.returnFrom.x) * easeOut(t);
      this.spin += (x - this.x) / this.r;
      this.x = x;
      this.y = b.floor;
      if (t >= 1) {
        this.mode = 'rest';
        this.returnFrom = undefined;
        this.target = 0;
        this.overTimer = setTimeout(() => this.finish(), GAME_OVER_MS);
      }
    }
  }

  private walls(): void {
    const b = this.box;
    if (this.x < b.minX) {
      this.x = b.minX;
      this.vx = Math.abs(this.vx) * WALL_BOUNCE;
    } else if (this.x > b.maxX) {
      this.x = b.maxX;
      this.vx = -Math.abs(this.vx) * WALL_BOUNCE;
    }
    if (this.y < b.minY) {
      this.y = b.minY;
      this.vy = Math.abs(this.vy) * WALL_BOUNCE;
    }
  }

  /** A header if he's in the air, otherwise the ball just bonks off his head. */
  private hitPimpek(prevY: number, now: number): void {
    const dx = this.x - this.petX;
    if (this.vy <= 0 || Math.abs(dx) > 0.32 * this.w) return;
    const headY = this.box.head - this.lift;
    if (this.airborne(now)) {
      if (Math.hypot(dx, this.y - headY) < this.r + 0.18 * this.w) this.headed();
    } else if (prevY + this.r <= headY && this.y + this.r > headY) {
      this.bonked(dx, headY, now);
    }
  }

  private headed(): void {
    this.dazed = false;
    this.streak++;
    this.total++;
    this.best = Math.max(this.best, this.streak);
    this.willJump = null;
    navigator.vibrate?.(15);
    // Up again, landing somewhere new so he has to run for it.
    const target = (Math.random() * 2 - 1) * this.box.range * 0.9;
    const apex = this.box.head - (0.9 + Math.random() * 0.5) * this.w;
    const { vx, vy } = this.aim(target, apex);
    this.vx = vx;
    this.vy = vy;
    this.hooks.mood(this.face());
    if (this.mood() === 'sad' && this.total === 3) this.say('Hej, to jest fajne! 🙂', LINE_MS);
    else if (this.streak === 1) this.say('Hop! 🎾', LINE_MS);
    else if (this.streak % 5 === 0) this.say(`${this.streak}! Ale seria! 🤩`, LINE_MS);
    else this.say(`${this.streak}!`, LINE_MS);
  }

  private bonked(dx: number, headY: number, now: number): void {
    const b = this.box;
    // Rolls off the side it landed on, unless the wall is right there — then towards the room.
    let side = Math.sign(dx) || 1;
    const room = side < 0 ? this.petX - b.minX : b.maxX - this.petX;
    if (room < 0.5 * this.w) side = -side;
    this.y = headY - this.r;
    this.vy = -Math.abs(this.vy) * 0.45;
    this.vx = side * Math.max(Math.abs(this.vx), 0.8 * this.w);
    this.willJump = false;
    this.dazed = true;
    this.wobbleAt = now;
    this.say(this.mood() === 'sleepy' ? 'Auć… 😴' : 'Bonk! 😵', LINE_MS);
  }

  private missed(): void {
    this.live = false;
    this.willJump = null;
    const streak = this.streak;
    this.streak = 0;
    if (this.ignoring) return;
    if (streak >= 3 && streak === this.best) this.say(`Rekord: ${streak} ${hitsWord(streak)}! 🏆`, LINE_MS);
    else if (streak >= 3) this.say(`Ups! ${streak} ${hitsWord(streak)} 👏`, LINE_MS);
    else if (this.mood() === 'sleepy') this.say('Jeszcze jedna i idziemy spać? 😴', LINE_MS);
    else this.say('Ups! 🙈', LINE_MS);
  }

  /** The ball stopped rolling: on the rug it stays, elsewhere he fetches it (or it rolls back). */
  private stopped(now: number): void {
    this.vx = 0;
    if (Math.abs(this.x - this.box.restX) < this.r) {
      this.mode = 'rest';
      this.target = 0;
      this.overTimer = setTimeout(() => this.finish(), GAME_OVER_MS);
      return;
    }
    this.mode = 'returning';
    if (this.ignoring || this.style().speed === 0) {
      this.returnFrom = { x: this.x, at: now + 600 };
      return;
    }
    // He stands on the far side and nudges it back towards the rug.
    this.returnFrom = { x: this.x, at: Infinity };
    const side = this.x < this.box.restX ? -1 : 1;
    this.target = clamp(this.x + side * 0.42 * this.w, -this.box.range, this.box.range);
    this.fetchUntil = now + FETCH_TIMEOUT_MS;
  }

  /** Where to stand and when to jump. */
  private think(now: number): void {
    if (this.fetchUntil !== undefined) {
      if (Math.abs(this.target - this.petX) < 2 || now > this.fetchUntil) {
        this.fetchUntil = undefined;
        this.returnFrom = { x: this.x, at: now };
        this.target = 0;
        this.wobbleAt = now;
      }
      return;
    }
    if (this.mode !== 'flying' || !this.live || this.ignoring || this.dazed) return;
    const style = this.style();
    if (style.speed === 0) return;
    if (this.willJump === null && this.vy > 0) this.willJump = Math.random() < style.jumps * TIRING ** this.streak;

    // When will the ball come down to the height he heads it, and where?
    const g = GRAVITY * this.w;
    const disc = this.vy * this.vy + 2 * g * (this.contactY() - this.y);
    let t = -1;
    let landX = this.x;
    if (disc >= 0) {
      t = (-this.vy + Math.sqrt(disc)) / g;
      if (t > 0) landX = clamp(this.x + this.vx * t, this.box.minX, this.box.maxX);
    }
    this.target = clamp(landX, -this.box.range, this.box.range);
    if (
      this.willJump &&
      this.jumpAt === undefined &&
      t > 0 &&
      t <= JUMP_LEAD_S &&
      Math.abs(landX - this.petX) < 0.4 * this.w
    ) {
      this.jumpAt = now;
    }
  }

  /** Hops towards the target, slower when sleepy. */
  private walk(dt: number): void {
    const speed = Math.max(this.style().speed, this.fetchUntil !== undefined ? 1 : 0.6);
    const step = speed * this.w * dt;
    const d = this.target - this.petX;
    this.petX += clamp(d, -step, step);
    const walking = Math.abs(d) > 1 && this.jumpAt === undefined;
    this.hop = walking ? this.hop + dt * 16 : 0;
  }

  private look(): void {
    const dx = this.x - this.petX;
    const dy = this.y - (this.box.eyes - this.lift);
    const distance = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, distance / GAZE_RANGE_PX);
    const gaze = {
      x: Math.round((dx / distance) * reach * 50) / 50,
      y: Math.round((dy / distance) * reach * 50) / 50,
    };
    if (gaze.x === this.lastGaze?.x && gaze.y === this.lastGaze?.y) return;
    this.lastGaze = gaze;
    this.hooks.look(gaze);
  }

  private render(): void {
    const { ball, skin, shadow, mover } = this.els;
    ball.style.transform = `translate(${this.x - this.r}px, ${this.y - this.r}px)`;
    skin.style.transform = `rotate(${this.spin}rad)`;
    const height = Math.max(0, this.box.floor - this.y);
    const s = Math.max(0.35, 1 - height / (1.5 * this.w));
    shadow.style.transform = `translate(${this.x}px, ${0.15 * this.r}px) translate(-50%, -50%) scale(${s})`;
    shadow.style.opacity = String(s);
    const hop = Math.abs(Math.sin(this.hop)) * 0.04 * this.w;
    mover.style.transform = this.active
      ? `translate(${this.petX}px, ${-(this.lift + hop)}px) scale(${this.sx}, ${this.sy})`
      : '';
  }
}
