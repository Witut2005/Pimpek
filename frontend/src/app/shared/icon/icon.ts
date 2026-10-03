import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Path data per icon, drawn on a 24×24 grid with round caps. Dots use a zero-length segment. */
const ICONS = {
  moon: ['M20 14.6A8.3 8.3 0 0 1 9.4 4 8.3 8.3 0 1 0 20 14.6Z'],
  apple: [
    'M12 8.3c-1.6-1.3-4.4-1.6-6 .2-2 2.2-1.6 6.4.5 9.4 1.5 2.1 3.4 3.3 5.5 2.4 2.1.9 4-.3 5.5-2.4 2.1-3 2.5-7.2.5-9.4-1.6-1.8-4.4-1.5-6-.2Z',
    'M12 8.2c0-2 .8-3.6 2.6-4.6',
  ],
  steps: [
    'M7.4 3.2c1.9 0 2.8 2 2.6 4.4-.2 2.1-1 3.6-2.6 3.6S5 9.7 4.8 7.6C4.6 5.2 5.5 3.2 7.4 3.2Z',
    'M5.2 14.2c.6-.5 3.8-.5 4.4 0 .5 2.2-.4 3.8-2.2 3.8s-2.7-1.6-2.2-3.8Z',
    'M16.6 6.2c1.9 0 2.8 2 2.6 4.4-.2 2.1-1 3.6-2.6 3.6s-2.4-1.5-2.6-3.6c-.2-2.4.7-4.4 2.6-4.4Z',
    'M14.4 17.2c.6-.5 3.8-.5 4.4 0 .5 2.2-.4 3.8-2.2 3.8s-2.7-1.6-2.2-3.8Z',
  ],
  smile: [
    'M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6Z',
    'M8.6 14.2c.9 1.2 2 1.9 3.4 1.9s2.5-.7 3.4-1.9',
    'M9.2 9.6h.01M14.8 9.6h.01',
  ],
  heart: ['M12 19.8s-7.6-4.4-7.6-10A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.6 2.5c0 5.6-7.6 10-7.6 10Z'],
  phone: ['M10 3h4a3.2 3.2 0 0 1 3.2 3.2v11.6A3.2 3.2 0 0 1 14 21h-4a3.2 3.2 0 0 1-3.2-3.2V6.2A3.2 3.2 0 0 1 10 3Z', 'M10.8 17.6h2.4'],
  sprout: [
    'M12 20.5v-7.8',
    'M12 12.7C12 8.9 9.6 6.9 5.1 6.9c0 3.8 2.4 5.8 6.9 5.8Z',
    'M12 10.8c0-3.4 2.2-5.4 6.6-5.4 0 3.4-2.2 5.4-6.6 5.4Z',
  ],
  pencil: ['M15.3 4.6a2.1 2.1 0 0 1 3 0l1.1 1.1a2.1 2.1 0 0 1 0 3L9.2 18.9l-4.6 1 1-4.6Z', 'M13.6 6.4l4 4'],
  calendar: ['M7.4 5.2h9.2a3.6 3.6 0 0 1 3.6 3.6v7.8a3.6 3.6 0 0 1-3.6 3.6H7.4a3.6 3.6 0 0 1-3.6-3.6V8.8a3.6 3.6 0 0 1 3.6-3.6Z', 'M8 3.4v3.4M16 3.4v3.4M3.8 10.2h16.4'],
  close: ['M7 7l10 10M17 7 7 17'],
  cloud: ['M7.2 18.5h9.6a3.9 3.9 0 0 0 .5-7.8 5.6 5.6 0 0 0-10.8 1.1 3.4 3.4 0 0 0 .7 6.7Z'],
  'cloud-off': ['M7.2 18.5h9.6a3.9 3.9 0 0 0 .5-7.8 5.6 5.6 0 0 0-10.8 1.1 3.4 3.4 0 0 0 .7 6.7Z', 'M4 4l16 16'],
  refresh: ['M19.5 12a7.5 7.5 0 0 1-13.1 5', 'M4.5 12a7.5 7.5 0 0 1 13.1-5', 'M17.6 3.6V7h-3.4', 'M6.4 20.4V17h3.4'],
  user: ['M12 4.9a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2Z', 'M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5'],
  leaf: ['M5 19.5C5 11 10 5.5 19.5 4.5 19.5 13 14 19 5 19.5Z', 'M5 19.5 12.5 12'],
  bag: ['M5.5 8.5h13l-1 11a1.6 1.6 0 0 1-1.6 1.5H8.1a1.6 1.6 0 0 1-1.6-1.5Z', 'M9 8.5V7a3 3 0 0 1 6 0v1.5'],
  star: ['M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8Z'],
  bell: ['M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5Z', 'M10 20.5a2.2 2.2 0 0 0 4 0'],
  shield: ['M12 3.5l7 2.8v5.2c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6.3Z'],
  watch: [
    'M10 6.5h4a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3Z',
    'M9.5 6.5l.6-3h3.8l.6 3M9.5 17.5l.6 3h3.8l.6-3',
    'M12 10v2.2l1.4 1',
  ],
  ring: ['M12 4.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15Z', 'M12 7.2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6Z'],
  check: ['M5.5 12.5l4.2 4.2 8.8-9.2'],
  chevron: ['M8 10l4 4 4-4'],
  'arrow-left': ['M19 12H5M11 6l-6 6 6 6'],
  download: ['M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14'],
  trash: ['M5 7h14M10 4h4M7 7l.8 11.6a1.8 1.8 0 0 0 1.8 1.7h4.8a1.8 1.8 0 0 0 1.8-1.7L17 7'],
  flag: ['M6 21V4', 'M6 4.5c4-2 6 2 12 0v8c-6 2-8-2-12 0'],
  sparkle: ['M12 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5Z', 'M18.5 16.5v3M17 18h3'],
  chart: ['M5 19.5V12M10 19.5V6.5M15 19.5v-5M20 19.5V9'],
  pulse: ['M3 12.5h4l2.5-6 5 11 2.5-5H21'],
  mountain: ['M2.5 19.5 9.5 7.5l4.2 7 2.3-3.5 5.5 8.5Z'],
  clock: ['M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6Z', 'M12 7.5V12l3 2'],
  trophy: [
    'M8 4h8v5a4 4 0 0 1-8 0Z',
    'M8 6H5.5a2.5 2.5 0 0 0 2.6 3.9M16 6h2.5a2.5 2.5 0 0 1-2.6 3.9',
    'M12 13v3.5M8.5 20h7M9.5 20l.5-3.5h4l.5 3.5',
  ],
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
