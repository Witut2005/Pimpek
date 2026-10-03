import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AvatarState } from '../../core/models/check-in.model';
import { Gaze } from './gaze';
import { PIMPEK_PATHS } from './pimpek-paths';

let nextId = 0;

/** How far the pupils may travel inside the eye whites, in SVG units. */
const PUPIL_REACH = { x: 22, y: 14 };

/** The built-in Pimpek, drawn and animated in SVG. Uploaded skins replace him in PimpekAvatar. */
@Component({
  selector: 'app-pimpek-drawing',
  templateUrl: './pimpek-drawing.html',
  styleUrl: './pimpek-drawing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'is-' + state()",
    '[class.is-celebrating]': 'celebrating()',
    '[style.--body-base]': 'color()',
    '[class.is-tracking]': '!!gaze()',
    '[style.--gaze-x]': 'gazeX()',
    '[style.--gaze-y]': 'gazeY()',
    '[class.is-petted]': 'petted()',
  },
})
export class PimpekDrawing {
  readonly state = input.required<AvatarState>();
  readonly celebrating = input(false);
  /** Body colour picked in settings; sad and sick states still tint over it. */
  readonly color = input<string>();
  /** The pupils follow this instead of looking around on their own. */
  readonly gaze = input<Gaze | null>(null);
  /** Being stroked: eyes squeezed shut in a happy ^ ^ and blushing. */
  readonly petted = input(false);

  protected readonly gazeX = computed(() => `${(this.gaze()?.x ?? 0) * PUPIL_REACH.x}px`);
  protected readonly gazeY = computed(() => `${(this.gaze()?.y ?? 0) * PUPIL_REACH.y}px`);

  protected readonly paths = PIMPEK_PATHS;

  private readonly uid = `pimpek-${nextId++}`;
  protected readonly ids = {
    eyes: `${this.uid}-eyes`,
    body: `${this.uid}-body`,
    grin: `${this.uid}-grin`,
  };

  protected url(id: string): string {
    return `url(#${id})`;
  }
}
