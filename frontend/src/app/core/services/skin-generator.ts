import { Injectable } from '@angular/core';
import { strToU8, zipSync } from 'fflate';
import { AiError } from '../models/ai.model';
import { SkinPose } from '../models/skin.model';
import { AiProvider } from './ai/ai-provider';

/** Neutral first: it designs the character, every other pose is drawn from it. */
export const GENERATED_POSES: readonly SkinPose[] = ['neutral', 'happy', 'sleepy', 'sad', 'sick', 'celebrate'];

/** Same footprint as the built-in drawing and the sample packs. */
const VIEW_BOX = '0 0 780 850';
const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_TOKENS = 16000;

interface PoseBrief {
  label: string;
  /** What the user is told this pose animates. */
  hint: string;
  /** What the model is asked to draw. */
  prompt: string;
}

/**
 * Every mood the app can show and what it has to animate. Whole-body motion (breathing, bounce,
 * sway, droop, shiver, the celebration jump) comes from the app, so the SVG only moves details.
 */
export const POSE_BRIEFS: Record<SkinPose, PoseBrief> = {
  neutral: {
    label: 'Spokojny',
    hint: 'mruga i rozgląda się',
    prompt:
      'calm and content: relaxed gentle smile, eyes open. Animation: blinks about every 4 s (eyelids close briefly) and the pupils slowly glance left and right.',
  },
  happy: {
    label: 'Radosny',
    hint: 'szeroki uśmiech, rumieńce',
    prompt:
      'joyful: big open smile, sparkling eyes (or happy ^ ^ eyes), rosy cheeks. Animation: quick blinks, cheeks gently pulse, ears/tail/antennae wiggle if the character has them.',
  },
  sleepy: {
    label: 'Śpiący',
    hint: 'opadające powieki, ziewa',
    prompt:
      'sleepy: heavy half-closed eyelids, small yawning "o" mouth, slightly paler colours. Animation: eyelids slowly droop and lift again (about 3 s), the mouth slowly opens into a yawn. Do not draw Zzz or any letters, the app adds them.',
  },
  sad: {
    label: 'Smutny',
    hint: 'podkówka, spływa łezka',
    prompt:
      'sad: downturned mouth, worried eyebrows raised in the middle, a tear under one eye, colours a little desaturated. Animation: the tear slowly slides down and fades out, then repeats; an occasional slow blink.',
  },
  sick: {
    label: 'Chory',
    hint: 'zielonkawy, spływa pot',
    prompt:
      'unwell: pale greenish tint on the face, wavy queasy mouth, tired eyes, a sweat drop on the forehead (a small thermometer or bandage is fine). Animation: the sweat drop slides down and fades out; slow tired blinks.',
  },
  celebrate: {
    label: 'Świętuje',
    hint: 'ręce w górze, konfetti',
    prompt:
      'celebrating a success: arms (or paws, fins, leaves) raised high, huge open smile, eyes closed in joy (^ ^), a few confetti pieces around the head, inside the viewBox. Animation: confetti falls and twinkles, arms wave. This clip plays for 2 seconds while the app makes the whole body jump.',
  },
};

const SYSTEM = `You are an illustrator drawing a cute virtual pet for "Pimpek", a wellbeing app where the pet's mood mirrors how well the user sleeps, eats and moves.
Answer with exactly one standalone SVG document and nothing else: no markdown fences, no explanations.

Technical rules:
- Root element: <svg xmlns="${SVG_NS}" viewBox="${VIEW_BOX}">, without width or height.
- Transparent background. Never draw a background, floor, frame, scenery or text.
- One character, centred horizontally (x ≈ 390), filling roughly x 150–630 and y 120–830. Its lowest point (feet or base) sits at y ≈ 830. A soft ground shadow ellipse at cy ≈ 830 is fine.
- Self-contained: no <script>, <image>, <foreignObject>, <text>, external URLs or web fonts. Gradients, clip paths and masks are fine.
- Animate with CSS in a single <style> element inside the SVG, not SMIL. Every looping animation is infinite and loops seamlessly.
- Animate only details: eyes, eyelids, pupils, mouth, cheeks, tears, sweat, ears, tail, antennae, limbs. The app already moves the whole body (breathing, bouncing, swaying, shivering, jumping), so never animate the position, scale or rotation of the whole character.
- Every animated element gets transform-box: fill-box and a sensible transform-origin.
- Keep it light, under 12 KB: bold rounded shapes, flat colours with soft gradients, a friendly kawaii look that still reads at 64 px.
- Name the main groups with classes (body, eyes, mouth, …).`;

/** The bare <svg> from a model's answer, safe to keep and show. Throws AiError when there is none. */
export function cleanSvg(answer: string): string {
  const start = answer.search(/<svg[\s>]/i);
  const end = answer.toLowerCase().lastIndexOf('</svg>');
  if (start < 0) throw new AiError('Model nie odesłał rysunku. Spróbuj jeszcze raz.');
  if (end < start) {
    throw new AiError('Rysunek urwał się w połowie. Spróbuj jeszcze raz albo wybierz mocniejszy model.');
  }
  let source = answer.slice(start, end + '</svg>'.length);
  // Without the namespace the browser parses it as plain XML and shows nothing.
  if (!/<svg[^>]*\sxmlns=/i.test(source)) source = source.replace(/<svg/i, `<svg xmlns="${SVG_NS}"`);

  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  const svg = doc.documentElement;
  if (doc.querySelector('parsererror') || svg.localName !== 'svg') {
    throw new AiError('Model odesłał uszkodzony rysunek. Spróbuj jeszcze raz.');
  }

  // Shown through <img>, which never runs scripts, but the pack can be downloaded and opened.
  svg.querySelectorAll('script, foreignObject').forEach((el) => el.remove());
  for (const el of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
    for (const attr of Array.from(el.attributes)) {
      const external = attr.localName === 'href' && !/^(#|data:image\/)/i.test(attr.value.trim());
      if (attr.name.toLowerCase().startsWith('on') || external) el.removeAttribute(attr.name);
    }
  }
  if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', VIEW_BOX);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  return new XMLSerializer().serializeToString(svg);
}

export interface SkinBrief {
  name: string;
  description: string;
}

export interface DrawOptions {
  provider: AiProvider;
  apiKey: string;
  model: string;
  signal?: AbortSignal;
}

/** Draws a whole skin pack with the user's AI: one animated SVG per mood. */
@Injectable({ providedIn: 'root' })
export class SkinGenerator {
  /** The neutral pose, which designs the character. */
  drawBase(brief: SkinBrief, options: DrawOptions): Promise<string> {
    return this.draw(
      `Design a new character called "${brief.name}".
The user's description (it may be in Polish): """${brief.description}"""

Draw it in the "neutral" pose — ${POSE_BRIEFS.neutral.prompt}`,
      options,
    );
  }

  /** Any other pose, redrawn from the neutral SVG so it stays the same character. */
  drawPose(pose: SkinPose, brief: SkinBrief, base: string, options: DrawOptions): Promise<string> {
    return this.draw(
      `This is the character "${brief.name}" in its neutral pose:

${base}

Draw the same character in the "${pose}" pose — ${POSE_BRIEFS[pose].prompt}
Keep its shape, proportions, colours, outlines, accessories, viewBox and position identical. Change only the expression, small details and the pose of its limbs. Return the complete SVG.`,
      options,
    );
  }

  /** A skin pack exactly like a hand-made one, so SkinStore stores and restores it as usual. */
  pack(name: string, svgs: Partial<Record<SkinPose, string>>): Uint8Array {
    const files: Record<string, Uint8Array> = {
      // motion: the app's own bounce and sway play on top, the SVGs only animate details.
      'manifest.json': strToU8(JSON.stringify({ name, fallback: 'neutral', motion: true }, null, 2)),
    };
    for (const [pose, svg] of Object.entries(svgs)) {
      if (svg) files[`${pose}.svg`] = strToU8(svg);
    }
    return zipSync(files);
  }

  private async draw(prompt: string, { provider, apiKey, model, signal }: DrawOptions): Promise<string> {
    const answer = await provider.complete({ apiKey, model, system: SYSTEM, prompt, maxTokens: MAX_TOKENS, signal });
    return cleanSvg(answer);
  }
}
