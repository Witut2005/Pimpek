import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { AnimationItem } from 'lottie-web';
import { AvatarState } from '../../core/models/check-in.model';
import { PetSkin } from '../../core/models/skin.model';
import { Gaze } from './gaze';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Plays an uploaded skin: the clip for the current state, or its celebration while there is one.
 * While reacting it stays in its mood's clip and only gives a short nudge in that mood's style.
 * Stroked, tickled or hugged it plays the pack's touch clip, if it drew one.
 */
@Component({
  selector: 'app-skin-player',
  templateUrl: './skin-player.html',
  styleUrl: './skin-player.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'is-' + state()",
    '[class.is-celebrating]': 'celebrating()',
    '[class.is-reacting]': 'reacting()',
    '[class.is-moving]': 'skin().motion',
    '[style.transform]': 'lean()',
  },
})
export class SkinPlayer {
  readonly skin = input.required<PetSkin>();
  readonly state = input.required<AvatarState>();
  readonly celebrating = input(false);
  readonly reacting = input(false);
  /** A pack's pupils are out of reach, so the whole skin leans towards the pointer instead. */
  readonly gaze = input<Gaze | null>(null);
  readonly petted = input(false);
  readonly tickled = input(false);
  readonly hugged = input(false);

  protected readonly lean = computed(() => {
    const gaze = this.gaze();
    return gaze ? `rotate(${(gaze.x * 4).toFixed(2)}deg) translateX(${(gaze.x * 2).toFixed(2)}%)` : '';
  });

  protected readonly clip = computed(() => {
    const clips = this.skin().clips;
    // Tickling and hugging borrow the stroking clip before falling back to the mood (happy by then).
    const touch =
      (this.tickled() && (clips.tickled ?? clips.petted)) ||
      (this.hugged() && (clips.hugged ?? clips.petted)) ||
      (this.petted() && clips.petted);
    return touch || (this.celebrating() && clips.celebrate) || clips[this.state()];
  });

  private readonly tick = signal(0);
  protected readonly frame = computed(() => {
    const clip = this.clip();
    return clip.kind === 'frames' ? clip.urls[this.tick() % clip.urls.length] : '';
  });

  private readonly lottieHost = viewChild<ElementRef<HTMLElement>>('lottie');

  constructor() {
    effect((onCleanup) => {
      const clip = this.clip();
      this.tick.set(0);
      if (clip.kind !== 'frames' || reducedMotion()) return;
      const timer = setInterval(() => this.tick.update((t) => t + 1), 1000 / clip.fps);
      onCleanup(() => clearInterval(timer));
    });

    effect((onCleanup) => {
      const host = this.lottieHost()?.nativeElement;
      const clip = this.clip();
      if (!host || clip.kind !== 'lottie') return;
      let animation: AnimationItem | undefined;
      let cancelled = false;
      // Lottie is heavy and most people never upload one, so it loads on first use.
      void import('lottie-web/build/player/lottie_light').then(({ default: lottie }) => {
        if (cancelled) return;
        animation = lottie.loadAnimation({
          container: host,
          renderer: 'svg',
          loop: true,
          autoplay: !reducedMotion(),
          // Lottie writes into the data it plays, and the same clip can serve several states.
          animationData: structuredClone(clip.data),
        });
      });
      onCleanup(() => {
        cancelled = true;
        animation?.destroy();
      });
    });
  }
}
