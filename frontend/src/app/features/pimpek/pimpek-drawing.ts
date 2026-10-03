import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AvatarState } from '../../core/models/check-in.model';
import { PIMPEK_PATHS } from './pimpek-paths';

let nextId = 0;

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
  },
})
export class PimpekDrawing {
  readonly state = input.required<AvatarState>();
  readonly celebrating = input(false);
  /** Body colour picked in settings; sad and sick states still tint over it. */
  readonly color = input<string>();

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
