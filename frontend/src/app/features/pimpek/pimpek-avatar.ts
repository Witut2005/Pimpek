import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AvatarState } from '../../core/models/check-in.model';
import { ItemId } from '../../core/models/item.model';
import { PIMPEK_PATHS } from './pimpek-paths';

let nextId = 0;

const BURST = ['💙', '⭐', '✨', '💚', '⭐', '💙', '✨', '💛'].map((icon, i) => ({
  icon,
  angle: i * 45,
}));

/**
 * Pure renderer of Pimpek. Everything about *how* he looks lives here, so this component
 * can later be swapped for a Lottie-based one with the same inputs.
 */
@Component({
  selector: 'app-pimpek-avatar',
  templateUrl: './pimpek-avatar.html',
  styleUrl: './pimpek-avatar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'is-' + state()",
    '[class.is-celebrating]': 'celebrating()',
  },
})
export class PimpekAvatar {
  readonly state = input.required<AvatarState>();
  readonly celebrating = input(false);
  readonly items = input<readonly ItemId[]>([]);

  protected readonly paths = PIMPEK_PATHS;
  protected readonly burst = BURST;

  private readonly uid = `pimpek-${nextId++}`;
  protected readonly ids = {
    eyes: `${this.uid}-eyes`,
    body: `${this.uid}-body`,
    grin: `${this.uid}-grin`,
    partyHat: `${this.uid}-party-hat`,
  };

  protected readonly wears = computed(() => new Set(this.items()));

  protected url(id: string): string {
    return `url(#${id})`;
  }
}
