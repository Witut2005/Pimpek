import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Path data per icon, drawn on a 24×24 grid with round caps. Dots use a zero-length segment. */
const ICONS = {
  heart: ['M12 19.8s-7.6-4.4-7.6-10A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.6 2.5c0 5.6-7.6 10-7.6 10Z'],
  sprout: [
    'M12 20.5v-7.8',
    'M12 12.7C12 8.9 9.6 6.9 5.1 6.9c0 3.8 2.4 5.8 6.9 5.8Z',
    'M12 10.8c0-3.4 2.2-5.4 6.6-5.4 0 3.4-2.2 5.4-6.6 5.4Z',
  ],
  pencil: ['M15.3 4.6a2.1 2.1 0 0 1 3 0l1.1 1.1a2.1 2.1 0 0 1 0 3L9.2 18.9l-4.6 1 1-4.6Z', 'M13.6 6.4l4 4'],
  calendar: ['M7.4 5.2h9.2a3.6 3.6 0 0 1 3.6 3.6v7.8a3.6 3.6 0 0 1-3.6 3.6H7.4a3.6 3.6 0 0 1-3.6-3.6V8.8a3.6 3.6 0 0 1 3.6-3.6Z', 'M8 3.4v3.4M16 3.4v3.4M3.8 10.2h16.4'],
  close: ['M7 7l10 10M17 7 7 17'],
  refresh: ['M19.5 12a7.5 7.5 0 0 1-13.1 5', 'M4.5 12a7.5 7.5 0 0 1 13.1-5', 'M17.6 3.6V7h-3.4', 'M6.4 20.4V17h3.4'],
  user: ['M12 4.9a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2Z', 'M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5'],
  bag: ['M5.5 8.5h13l-1 11a1.6 1.6 0 0 1-1.6 1.5H8.1a1.6 1.6 0 0 1-1.6-1.5Z', 'M9 8.5V7a3 3 0 0 1 6 0v1.5'],
  star: ['M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8Z'],
  bell: ['M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5Z', 'M10 20.5a2.2 2.2 0 0 0 4 0'],
  shield: ['M12 3.5l7 2.8v5.2c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6.3Z'],
  check: ['M5.5 12.5l4.2 4.2 8.8-9.2'],
  chevron: ['M8 10l4 4 4-4'],
  'arrow-left': ['M19 12H5M11 6l-6 6 6 6'],
  download: ['M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14'],
  trash: ['M5 7h14M10 4h4M7 7l.8 11.6a1.8 1.8 0 0 0 1.8 1.7h4.8a1.8 1.8 0 0 0 1.8-1.7L17 7'],
  sparkle: ['M12 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5Z', 'M18.5 16.5v3M17 18h3'],
} satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;

/**
 * Hand-drawn-style line icons (round caps, soft corners) used for UI chrome instead of emoji,
 * which render differently on every OS and make the app look generic.
 */
@Component({
  selector: 'app-icon',
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @for (d of paths(); track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      width: 1.25em;
      height: 1.25em;
      flex: none;
    }
    svg {
      width: 100%;
      height: 100%;
    }
    path[d$='.01'] {
      stroke-width: 2.8;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly name = input.required<IconName>();

  protected paths(): readonly string[] {
    return ICONS[this.name()];
  }
}
