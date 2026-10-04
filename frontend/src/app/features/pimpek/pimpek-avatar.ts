import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AvatarState } from '../../core/models/check-in.model';
import { SkinStore } from '../../core/state/skin.store';
import { Gaze } from './gaze';
import { PimpekDrawing } from './pimpek-drawing';
import { SkinPlayer } from './skin-player';

const BURST = ['💙', '⭐', '✨', '💚', '⭐', '💙', '✨', '💛'].map((icon, i) => ({
  icon,
  angle: i * 45,
}));

/**
 * Pimpek as the rest of the app sees him: the built-in drawing or the skin the user uploaded,
 * with the floating Zzz, sparkles and celebration burst around either.
 */
@Component({
  selector: 'app-pimpek-avatar',
  imports: [PimpekDrawing, SkinPlayer],
  templateUrl: './pimpek-avatar.html',
  styleUrl: './pimpek-avatar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-quiet]': 'quiet()',
  },
})
export class PimpekAvatar {
  readonly state = input.required<AvatarState>();
  readonly celebrating = input(false);
  /** Body colour picked in settings; sad and sick states still tint over it. */
  readonly color = input<string>();
  /** Thumbnails skip the floating sparkles and Zzz — at that size they're just noise. */
  readonly quiet = input(false);
  /** Where the pointer is, relative to his eyes; null lets him look around on his own. */
  readonly gaze = input<Gaze | null>(null);
  /** Being stroked right now. */
  readonly petted = input(false);
  /** Being tickled: giggling with squeezed > < eyes. */
  readonly tickled = input(false);
  /** Being hugged. The drawing shows it like stroking; a skin may have its own clip. */
  readonly hugged = input(false);

  protected readonly skin = inject(SkinStore).active;
  protected readonly burst = BURST;

  /**
   * An uploaded skin keeps its mood when something good happens: only a happy one throws a party,
   * the others just react the way that mood would — a sleepy one stays sleepy.
   */
  protected readonly cheering = computed(() => this.celebrating() && (!this.skin() || this.state() === 'happy'));

  /** A skin's face is out of reach, so one without its own tickling clip gets tears of laughter on top. */
  protected readonly skinTears = computed(() => this.tickled() && !!this.skin() && !this.skin()?.clips.tickled);
}
