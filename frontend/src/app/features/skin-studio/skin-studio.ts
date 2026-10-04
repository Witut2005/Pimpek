import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import { AiError } from '../../core/models/ai.model';
import { AvatarState } from '../../core/models/check-in.model';
import { PetSkin, SkinPose, TouchPose } from '../../core/models/skin.model';
import { readSkinPack } from '../../core/services/skin-pack';
import { GENERATED_POSES, POSE_BRIEFS, SkinBrief, SkinGenerator } from '../../core/services/skin-generator';
import { AiSettingsStore } from '../../core/state/ai-settings.store';
import { SkinStore } from '../../core/state/skin.store';
import { Icon } from '../../shared/icon/icon';
import { SkinPlayer } from '../pimpek/skin-player';

type Status = 'waiting' | 'drawing' | 'done' | 'error';

interface Draft {
  status: Status;
  svg?: string;
  error?: string;
}

const MOODS: readonly AvatarState[] = ['neutral', 'happy', 'sleepy', 'sad', 'sick'];
const TOUCHES: readonly TouchPose[] = ['petted', 'tickled', 'hugged'];
const CELEBRATION_MS = 1800;
const DEFAULT_NAME = 'Mój Pimpek';

const IDEAS = [
  'Puszysta chmurka z różowymi policzkami',
  'Mały kaktus w glinianej doniczce',
  'Pulchny smoczek z krótkimi skrzydełkami',
  'Żabka w słomkowym kapeluszu',
  'Kotek-ziemniaczek',
];

const emptyDrafts = (): Record<SkinPose, Draft> =>
  Object.fromEntries(GENERATED_POSES.map((pose) => [pose, { status: 'waiting' }])) as Record<SkinPose, Draft>;

/** The user describes a new look, their AI draws every mood, and it's saved like an uploaded pack. */
@Component({
  selector: 'app-skin-studio',
  imports: [Icon, SkinPlayer],
  templateUrl: './skin-studio.html',
  styleUrl: './skin-studio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkinStudio {
  protected readonly ai = inject(AiSettingsStore);
  private readonly generator = inject(SkinGenerator);
  private readonly skins = inject(SkinStore);

  readonly saved = output<void>();

  protected readonly poses = GENERATED_POSES;
  protected readonly briefs = POSE_BRIEFS;
  protected readonly moods = MOODS;
  protected readonly ideas = IDEAS;

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly showKey = signal(false);

  protected readonly drafts = signal(emptyDrafts());
  protected readonly started = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | undefined>(undefined);

  protected readonly busy = computed(() => Object.values(this.drafts()).some((d) => d.status === 'drawing'));
  protected readonly ready = computed(() => this.drafts().neutral.status === 'done');
  protected readonly doneCount = computed(
    () => Object.values(this.drafts()).filter((d) => d.status === 'done').length,
  );
  protected readonly canGenerate = computed(
    () => !!this.ai.apiKey() && !!this.description().trim() && !this.busy(),
  );

  /** Data URLs need no cleanup, unlike object URLs, and each tile plays its SVG's own animation. */
  protected readonly thumbs = computed(() => {
    const drafts = this.drafts();
    return Object.fromEntries(
      GENERATED_POSES.map((pose) => [pose, drafts[pose].svg ? toDataUrl(drafts[pose].svg) : '']),
    ) as Record<SkinPose, string>;
  });

  private readonly svgs = computed(() => {
    const drafts = this.drafts();
    return Object.fromEntries(
      GENERATED_POSES.filter((pose) => drafts[pose].svg).map((pose) => [pose, drafts[pose].svg]),
    ) as Partial<Record<SkinPose, string>>;
  });

  /** The pack as it will be saved, played with the app's own motion on top. */
  protected readonly preview = signal<PetSkin | undefined>(undefined);
  protected readonly previewMood = signal<AvatarState>('neutral');
  /** Plays a touch clip in the preview instead of the mood. */
  protected readonly previewTouch = signal<TouchPose | null>(null);
  protected readonly touches = TOUCHES;
  protected readonly celebrating = signal(false);

  private controller?: AbortController;
  private celebrationTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect((onCleanup) => {
      const svgs = this.svgs();
      if (!svgs.neutral) {
        this.preview.set(undefined);
        return;
      }
      const skin = readSkinPack('preview', 'podglad.zip', this.generator.pack(DEFAULT_NAME, svgs));
      this.preview.set(skin);
      onCleanup(() => skin.urls.forEach((url) => URL.revokeObjectURL(url)));
    });

    inject(DestroyRef).onDestroy(() => {
      this.controller?.abort();
      clearTimeout(this.celebrationTimer);
    });
  }

  protected setText(target: 'name' | 'description', event: Event): void {
    this[target].set((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  protected setKey(event: Event): void {
    this.ai.setKey((event.target as HTMLInputElement).value);
  }

  protected setModel(event: Event): void {
    this.ai.setModel((event.target as HTMLInputElement).value);
  }

  protected async generate(): Promise<void> {
    this.controller?.abort();
    const controller = (this.controller = new AbortController());
    this.drafts.set(emptyDrafts());
    this.previewMood.set('neutral');
    this.started.set(true);
    this.saveError.set(undefined);

    const base = await this.draw('neutral', controller.signal);
    if (!base) return;
    await Promise.all(
      GENERATED_POSES.filter((pose) => pose !== 'neutral').map((pose) => this.draw(pose, controller.signal, base)),
    );
  }

  /** Redraws one mood. The neutral one designs the character, so redrawing it starts over. */
  protected redraw(pose: SkinPose): void {
    const base = this.drafts().neutral.svg;
    if (pose === 'neutral' || !base) {
      void this.generate();
      return;
    }
    if (!this.controller || this.controller.signal.aborted) this.controller = new AbortController();
    void this.draw(pose, this.controller.signal, base);
  }

  protected cancel(): void {
    this.controller?.abort();
    this.drafts.update((drafts) =>
      Object.fromEntries(
        Object.entries(drafts).map(([pose, d]) => [pose, d.status === 'drawing' ? { status: 'waiting' } : d]),
      ) as Record<SkinPose, Draft>,
    );
  }

  protected celebrate(): void {
    clearTimeout(this.celebrationTimer);
    this.celebrating.set(true);
    this.celebrationTimer = setTimeout(() => this.celebrating.set(false), CELEBRATION_MS);
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    this.saveError.set(undefined);
    try {
      await this.skins.add(this.packFile());
      this.drafts.set(emptyDrafts());
      this.started.set(false);
      this.name.set('');
      this.description.set('');
      this.saved.emit();
    } catch {
      this.saveError.set('Nie udało się zapisać wyglądu. Spróbuj jeszcze raz.');
    } finally {
      this.saving.set(false);
    }
  }

  protected download(): void {
    const file = this.packFile();
    const url = URL.createObjectURL(file);
    const link = Object.assign(document.createElement('a'), { href: url, download: file.name });
    link.click();
    URL.revokeObjectURL(url);
  }

  private packFile(): File {
    const name = this.name().trim() || DEFAULT_NAME;
    const zip = this.generator.pack(name, this.svgs()) as Uint8Array<ArrayBuffer>;
    return new File([zip], `${name}.zip`, { type: 'application/zip' });
  }

  private async draw(pose: SkinPose, signal: AbortSignal, base?: string): Promise<string | undefined> {
    this.patch(pose, { status: 'drawing' });
    const brief: SkinBrief = { name: this.name().trim() || DEFAULT_NAME, description: this.description().trim() };
    const options = {
      provider: this.ai.provider(),
      apiKey: this.ai.apiKey(),
      model: this.ai.model(),
      signal,
    };
    try {
      const svg = base
        ? await this.generator.drawPose(pose, brief, base, options)
        : await this.generator.drawBase(brief, options);
      if (signal.aborted) return undefined;
      this.patch(pose, { status: 'done', svg });
      return svg;
    } catch (error) {
      if (signal.aborted) return undefined;
      const message = error instanceof AiError ? error.message : 'Coś poszło nie tak. Spróbuj jeszcze raz.';
      this.patch(pose, { status: 'error', error: message });
      return undefined;
    }
  }

  private patch(pose: SkinPose, draft: Draft): void {
    this.drafts.update((drafts) => ({ ...drafts, [pose]: draft }));
  }
}

function toDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
