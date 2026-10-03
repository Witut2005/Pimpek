import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AvatarState } from '../../core/models/check-in.model';
import { Gaze } from './gaze';
import { PimpekAvatar } from './pimpek-avatar';

/** Past this distance from his eyes the gaze is at full stretch. */
const GAZE_RANGE_PX = 260;
/** No pointer movement for this long and he goes back to looking around on his own. */
const GAZE_IDLE_MS = 2500;
/** Finger, pen or pressed mouse: this much stroking counts as petting. */
const PET_PRESSED_PX = 110;
/** A plain hovering mouse needs a longer, back-and-forth stroke, so passing over him doesn't count. */
const PET_HOVER_PX = 220;
const PET_HOVER_REVERSALS = 2;
/** A pause longer than this starts a new stroke. */
const STROKE_GAP_MS = 400;
/** Moving further than this between press and release is a drag, not a tap. */
const TAP_SLOP_PX = 12;
const HEART_EVERY_PX = 70;
const MAX_HEARTS = 10;
const HEART_LIFE_MS = 1300;
/** He stays blissful a moment after the stroking stops. */
const PET_LINGER_MS = 900;

const PURRS = ['Mrrr… jak miło 💙', 'Hihi, łaskocze! 😊', 'Jeszcze, jeszcze! 🥰', 'Uwielbiam to 💛', 'Mrrr… mrrr… 💗'];
const HEARTS = ['💗', '💛', '🧡', '💙'];

interface Stroke {
  x: number;
  y: number;
  distance: number;
  sinceHeart: number;
  dirX: number;
  dirY: number;
  reversals: number;
  at: number;
  pressed: boolean;
}

interface Heart {
  id: number;
  x: number;
  y: number;
  icon: string;
}

/**
 * Pimpek on stage: speech bubble and tap target around the avatar. His eyes follow the pointer
 * and he purrs when stroked. Pointer listeners are native, so moving the mouse never runs
 * change detection — only the signals they set do.
 */
@Component({
  selector: 'app-pimpek',
  imports: [PimpekAvatar],
  templateUrl: './pimpek.html',
  styleUrl: './pimpek.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pimpek {
  readonly state = input.required<AvatarState>();
  readonly message = input.required<string>();
  readonly celebrating = input(false);
  readonly color = input<string>();
  /** Pimpek is waiting for today's check-in. */
  readonly needsAttention = input(false);

  readonly petClick = output<void>();

  private readonly pet = viewChild.required<ElementRef<HTMLButtonElement>>('pet');

  protected readonly gaze = signal<Gaze | null>(null);
  protected readonly petting = signal(false);
  protected readonly hearts = signal<Heart[]>([]);
  private readonly purr = signal(PURRS[0]);

  /** While stroked he's happy whatever his mood, and says so. */
  protected readonly shownState = computed<AvatarState>(() => (this.petting() ? 'happy' : this.state()));
  protected readonly shownMessage = computed(() => (this.petting() ? this.purr() : this.message()));

  private stroke?: Stroke;
  /** A press that turned into stroking (or any drag) must not also open the check-in. */
  private strokedThisPress = false;
  private pressAt?: { x: number; y: number };
  private nextHeart = 0;
  private gazeTimer?: ReturnType<typeof setTimeout>;
  private petTimer?: ReturnType<typeof setTimeout>;
  private frame = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const pet = this.pet().nativeElement;
      const track = (e: PointerEvent) => this.track(e);
      const stroke = (e: PointerEvent) => this.onStroke(e);
      // The stroke starts where the finger lands, so even one fast swipe counts.
      const press = (e: PointerEvent) => {
        this.strokedThisPress = false;
        this.pressAt = { x: e.clientX, y: e.clientY };
        this.stroke = { ...this.pressAt, distance: 0, sinceHeart: 0, dirX: 0, dirY: 0, reversals: 0, at: performance.now(), pressed: true };
      };
      document.addEventListener('pointermove', track, { passive: true });
      document.addEventListener('pointerdown', track, { passive: true });
      pet.addEventListener('pointermove', stroke, { passive: true });
      pet.addEventListener('pointerdown', press, { passive: true });
      destroyRef.onDestroy(() => {
        document.removeEventListener('pointermove', track);
        document.removeEventListener('pointerdown', track);
        pet.removeEventListener('pointermove', stroke);
        pet.removeEventListener('pointerdown', press);
        cancelAnimationFrame(this.frame);
        clearTimeout(this.gazeTimer);
        clearTimeout(this.petTimer);
      });
    });
  }

  protected onClick(): void {
    if (this.strokedThisPress) {
      this.strokedThisPress = false;
      return;
    }
    this.petClick.emit();
  }

  /** Points the eyes at the pointer, once per frame. */
  private track(e: PointerEvent): void {
    const { clientX, clientY } = e;
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const rect = this.pet().nativeElement.getBoundingClientRect();
      // His eyes sit right in the middle of the avatar box.
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, distance / GAZE_RANGE_PX);
      this.gaze.set({ x: (dx / distance) * reach, y: (dy / distance) * reach });
    });
    clearTimeout(this.gazeTimer);
    this.gazeTimer = setTimeout(() => this.gaze.set(null), GAZE_IDLE_MS);
  }

  private onStroke(e: PointerEvent): void {
    const pressed = e.pointerType !== 'mouse' || e.buttons > 0;
    if (pressed && this.pressAt && Math.hypot(e.clientX - this.pressAt.x, e.clientY - this.pressAt.y) > TAP_SLOP_PX) {
      this.strokedThisPress = true;
    }
    const now = performance.now();
    const s = this.stroke;
    if (!s || s.pressed !== pressed) {
      this.stroke = { x: e.clientX, y: e.clientY, distance: 0, sinceHeart: 0, dirX: 0, dirY: 0, reversals: 0, at: now, pressed };
      return;
    }
    // After a pause the count starts over, but this movement (from where the pointer rested) still counts.
    if (now - s.at > STROKE_GAP_MS) {
      Object.assign(s, { distance: 0, sinceHeart: 0, dirX: 0, dirY: 0, reversals: 0 });
    }
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const step = Math.hypot(dx, dy);
    if (step < 2) return;

    // Back-and-forth along either axis is what makes it a stroke rather than a pass.
    const dirX = Math.abs(dx) > 3 ? Math.sign(dx) : 0;
    const dirY = Math.abs(dy) > 3 ? Math.sign(dy) : 0;
    if ((dirX && s.dirX && dirX !== s.dirX) || (dirY && s.dirY && dirY !== s.dirY)) s.reversals++;
    s.dirX = dirX || s.dirX;
    s.dirY = dirY || s.dirY;
    s.distance += step;
    s.sinceHeart += step;
    s.x = e.clientX;
    s.y = e.clientY;
    s.at = now;

    const petting = pressed
      ? s.distance > PET_PRESSED_PX
      : s.distance > PET_HOVER_PX && s.reversals >= PET_HOVER_REVERSALS;
    if (petting) this.petted(e, s);
  }

  private petted(e: PointerEvent, s: Stroke): void {
    if (!this.petting()) {
      this.purr.set(PURRS[Math.floor(Math.random() * PURRS.length)]);
      this.petting.set(true);
    }
    if (s.sinceHeart >= HEART_EVERY_PX) {
      s.sinceHeart = 0;
      this.addHeart(e);
      navigator.vibrate?.(12);
    }
    clearTimeout(this.petTimer);
    this.petTimer = setTimeout(() => this.petting.set(false), PET_LINGER_MS);
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
