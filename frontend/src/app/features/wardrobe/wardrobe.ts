import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { PetStore } from '../../core/state/pet.store';

@Component({
  selector: 'app-wardrobe',
  imports: [DecimalPipe],
  templateUrl: './wardrobe.html',
  styleUrl: './wardrobe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Wardrobe {
  protected readonly store = inject(PetStore);
}
