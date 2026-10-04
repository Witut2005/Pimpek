import { booleanAttribute, ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';
import { Icon } from '../icon/icon';

/** Bottom sheet built on the native <dialog> (focus trap, Esc and backdrop for free). */
@Component({
  selector: 'app-sheet',
  imports: [Icon],
  template: `
    <dialog #dialog [class.fixed]="fixed()" (click)="onDialogClick($event)" [attr.aria-label]="title()">
      <div class="panel">
        <header>
          <h2>{{ title() }}</h2>
          <button type="button" class="icon-btn" (click)="close()" aria-label="Zamknij">
            <app-icon name="close" />
          </button>
        </header>
        <ng-content />
      </div>
    </dialog>
  `,
  styleUrl: './sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sheet {
  readonly title = input.required<string>();
  /** Full height regardless of content, so the top edge never jumps as the content changes. */
  readonly fixed = input(false, { transform: booleanAttribute });
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  open(): void {
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }
}
