import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { AvatarState } from '../../core/models/check-in.model';

/** The ball shows under its cup this long before the shuffling starts. */
const SHOW_MS = 1200;
/** The lifted cup takes this long to come down (see .shape in the styles). */
const LOWER_MS = 380;
/** A wrong guess: the right cup comes up after this. */
const MISS_MS = 650;
const REVEAL_MS = 1900;
/** Every win in a row adds two swaps and makes each one quicker. */
const SWAPS = 4;
const MAX_SWAPS = 14;
const SWAP_MS = 640;
const FASTER_MS = 55;
const MIN_SWAP_MS = 260;
/** A shuffling cup rises this much of its height over the other one. */
const ARC = 0.45;

/** How slowly each mood shuffles. */
const PACE: Record<AvatarState, number> = {
  happy: 1,
  neutral: 1.1,
  sad: 1.25,
  sleepy: 1.6,
  sick: 1.8,
};

const SHOW: Record<AvatarState, string> = {
  happy: 'Patrz! Piłka jest tutaj 👀',
  neutral: 'Piłka jest tu. Uważaj! 👀',
  sad: 'Piłka jest tutaj… 👀',
  sleepy: 'Piłeczka… tutaj… 😴',
  sick: 'Piłka jest tu… 🤒',
};

const MISS: Record<AvatarState, string> = {
  happy: 'Pudło! Hihi 😜',
  neutral: 'Pudło! 🙈',
  sad: 'Ojej, pudło… 😔',
  sleepy: 'Pudło… ziew 😴',
  sick: 'Pudło… 🤒',
};

const PLACES = ['z lewej', 'w środku', 'z prawej'];

type Phase = 'idle' | 'showing' | 'shuffling' | 'picking' | 'revealed';

/**
 * Three cups: Pimpek hides his ball under one, shuffles them and you guess where it went. Every
 * win in a row shuffles longer and quicker; a sleepy or poorly Pimpek shuffles slowly.
 *
 * The cups stand on three places; a swap is a Web Animation along an arc, and the cup's own
 * --place takes over when it ends.
 */
@Component({
  selector: 'app-pimpek-cups',
  templateUrl: './pimpek-cups.html',
  styleUrl: './pimpek-cups.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PimpekCups {
  readonly state = input.required<AvatarState>();

  /** Something to say in the bubble; null hands it back. */
  readonly say = output<string | null>();
  /** The face he pulls while playing; null when the round is over. */
  readonly face = output<AvatarState | null>();
  /** A point on screen he looks at; null hands his eyes back to the pointer. */
  readonly look = output<{ x: number; y: number } | null>();
  /** A right guess. */
  readonly cheer = output<void>();

  private readonly row = viewChild.required<ElementRef<HTMLElement>>('row');
  private readonly cupEls = viewChildren<ElementRef<HTMLElement>>('cup');

  protected readonly cups = [0, 1, 2];
  protected readonly phase = signal<Phase>('idle');
  /** The cup (not the place) the ball is under. */
  protected readonly ballCup = signal(1);
  protected readonly lifted = signal<readonly number[]>([]);
  /** Where each cup stands, 0 (left) to 2. */
  protected readonly places = signal<readonly number[]>([0, 1, 2]);

  private streak = 0;
  private wins = 0;
  private alive = true;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.alive = false;
      this.timers.forEach(clearTimeout);
      this.cupEls().forEach((c) => c.nativeElement.getAnimations().forEach((a) => a.cancel()));
    });
  }

  protected label(cup: number): string {
    return `Kubek ${PLACES[this.places()[cup]]}`;
  }

  protected pick(cup: number): void {
    if (this.phase() === 'idle') void this.play();
    else if (this.phase() === 'picking') void this.choose(cup);
  }

  private async play(): Promise<void> {
    const mood = this.state();
    const ball = Math.floor(Math.random() * 3);
    this.ballCup.set(ball);
    this.phase.set('showing');
    this.face.emit(this.playFace());
    this.say.emit(SHOW[mood]);
    this.lifted.set([ball]);
    this.lookAt(ball);
    if (!(await this.wait(SHOW_MS))) return;
    this.lifted.set([]);
    if (!(await this.wait(LOWER_MS))) return;

    this.phase.set('shuffling');
    this.say.emit(mood === 'sleepy' || mood === 'sick' ? 'Mieszam… powoli… 🌀' : 'Mieszam! 🌀');
    const swaps = Math.min(SWAPS + 2 * this.streak, MAX_SWAPS);
    const ms = Math.max(MIN_SWAP_MS, SWAP_MS - FASTER_MS * this.streak) * PACE[mood];
    for (let i = 0; i < swaps; i++) {
      const a = Math.floor(Math.random() * 3);
      const b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
      if (!(await this.swap(a, b, ms))) return;
    }

    this.phase.set('picking');
    this.say.emit('Gdzie jest piłka? 🤔');
    this.look.emit(null);
  }

  private async choose(cup: number): Promise<void> {
    const ball = this.ballCup();
    this.phase.set('revealed');
    this.lifted.set([cup]);
    this.lookAt(cup);
    if (cup === ball) {
      this.streak++;
      this.wins++;
      navigator.vibrate?.(20);
      this.cheer.emit();
      this.face.emit(this.state() === 'sick' ? 'sick' : 'happy');
      this.say.emit(
        this.streak === 1 ? 'Brawo! Trafione! 🎉' : `${this.streak} z rzędu! Teraz pomieszam szybciej 🤩`,
      );
    } else {
      const streak = this.streak;
      this.streak = 0;
      this.face.emit(this.playFace());
      this.say.emit(streak >= 3 ? `Pudło! Ale ${streak} z rzędu to rekord! 🏆` : MISS[this.state()]);
      if (!(await this.wait(MISS_MS))) return;
      this.lifted.set([cup, ball]);
      this.lookAt(ball);
      this.say.emit('Tu była! Jeszcze raz? 🙂');
    }
    if (!(await this.wait(REVEAL_MS))) return;
    this.lifted.set([]);
    this.phase.set('idle');
    this.face.emit(null);
    this.look.emit(null);
  }

  /** Cups a and b trade places: a arcs over the top, b slides under it. */
  private async swap(a: number, b: number, ms: number): Promise<boolean> {
    const els = this.cupEls().map((c) => c.nativeElement);
    const [ea, eb] = [els[a], els[b]];
    const gap = this.row().nativeElement.offsetWidth / 3;
    const places = this.places();
    const xa = (places[a] - 1) * gap;
    const xb = (places[b] - 1) * gap;
    const lift = this.reduced ? 0 : ARC * ea.offsetHeight;
    const arc = (from: number, to: number, dy: number, scale: number) => [
      { transform: `translate(${from}px, 0) scale(1)` },
      { transform: `translate(${(from + to) / 2}px, ${dy}px) scale(${scale})` },
      { transform: `translate(${to}px, 0) scale(1)` },
    ];
    const timing = { duration: ms, easing: 'ease-in-out' };
    ea.style.zIndex = '2';
    eb.style.zIndex = '1';
    this.places.update((p) => p.map((place, i) => (i === a ? p[b] : i === b ? p[a] : place)));
    const rect = this.row().nativeElement.getBoundingClientRect();
    this.look.emit({ x: rect.left + rect.width / 2 + (xa + xb) / 2, y: rect.top + rect.height / 2 });
    await Promise.all([
      ea.animate(arc(xa, xb, -lift, this.reduced ? 1 : 1.06), timing).finished,
      eb.animate(arc(xb, xa, lift * 0.15, this.reduced ? 1 : 0.94), timing).finished,
    ]).catch(() => undefined);
    return this.alive;
  }

  /** Happy and neutral play happily; sad brightens with every win; sleepy and sick stay so. */
  private playFace(): AvatarState {
    const mood = this.state();
    if (mood === 'sad') return this.wins >= 3 ? 'happy' : this.wins >= 1 ? 'neutral' : 'sad';
    return mood === 'neutral' ? 'happy' : mood;
  }

  private lookAt(cup: number): void {
    const el = this.cupEls()[cup]?.nativeElement;
    if (!el) return;
    const r = el.getBoundingClientRect();
    this.look.emit({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }

  /** Resolves with whether the game is still on screen. */
  private wait(ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        resolve(this.alive);
      }, ms);
      this.timers.add(timer);
    });
  }
}
