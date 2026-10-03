import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AvatarState } from '../../core/models/check-in.model';
import { ItemId } from '../../core/models/item.model';
import { PimpekAvatar } from './pimpek-avatar';

/** Pimpek on stage: speech bubble and tap target around the avatar. */
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
  readonly items = input<readonly ItemId[]>([]);
  readonly celebrating = input(false);
  readonly color = input<string>();
  /** Pimpek is waiting for today's check-in. */
  readonly needsAttention = input(false);

  readonly petClick = output<void>();
}
