import { ChangeDetectionStrategy, Component, output } from '@angular/core';

/** The bathtub in front of Pimpek, hiding his lower third, with a rubber duck on the rim. */
@Component({
  selector: 'app-pimpek-tub',
  templateUrl: './pimpek-tub.html',
  styleUrl: './pimpek-tub.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PimpekTub {
  readonly squeak = output<void>();
}
