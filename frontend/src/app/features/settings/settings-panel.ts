import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { PET_COLORS, PetColor } from '../../core/models/settings.model';
import { PetSkin } from '../../core/models/skin.model';
import { DEFAULT_LINES, LINE_MAX_LENGTH, SPEECH_SITUATIONS, SpeechSituation } from '../../core/models/speech.model';
import { SKIN_STATES, SkinPackError } from '../../core/services/skin-pack';
import { SettingsStore } from '../../core/state/settings.store';
import { SkinStore } from '../../core/state/skin.store';
import { Icon } from '../../shared/icon/icon';
import { Sheet } from '../../shared/sheet/sheet';
import { skinDb } from '../../shared/skin-db';
import { clearAll, KEYS, readJson } from '../../shared/storage';
import { PimpekDrawing } from '../pimpek/pimpek-drawing';
import { SkinPlayer } from '../pimpek/skin-player';
import { SkinStudio } from '../skin-studio/skin-studio';

@Component({
  selector: 'app-settings-panel',
  imports: [Icon, PimpekDrawing, SkinPlayer, Sheet, SkinStudio],
  templateUrl: './settings-panel.html',
  styleUrl: './settings-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPanel {
  protected readonly settings = inject(SettingsStore);
  protected readonly skins = inject(SkinStore);

  protected readonly colors = Object.entries(PET_COLORS) as [PetColor, { label: string; hex: string }][];
  protected readonly confirmDelete = signal(false);
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal<string | undefined>(undefined);
  protected readonly dragging = signal(false);

  protected readonly situations = SPEECH_SITUATIONS;
  protected readonly defaultLines = DEFAULT_LINES;
  protected readonly lineMax = LINE_MAX_LENGTH;

  /** Clears the field only when the line was taken, so a duplicate stays there to fix. */
  protected addLine(situation: SpeechSituation, field: HTMLInputElement): void {
    if (this.settings.addLine(situation, field.value)) field.value = '';
  }

  /** Renames whichever Pimpek is on screen — each look keeps its own name. */
  protected rename(event: Event): void {
    const name = (event.target as HTMLInputElement).value;
    const skin = this.skins.active();
    if (skin) void this.skins.rename(skin.id, name);
    else this.settings.update({ petName: name });
  }

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.upload(file);
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) void this.upload(file);
  }

  private async upload(file: File): Promise<void> {
    this.uploading.set(true);
    this.uploadError.set(undefined);
    try {
      await this.skins.add(file);
    } catch (error) {
      this.uploadError.set(
        error instanceof SkinPackError ? error.message : 'Nie udało się wczytać paczki. Spróbuj innego pliku .zip.',
      );
    } finally {
      this.uploading.set(false);
    }
  }

  /** How many of the five moods the pack really draws; the rest are borrowed. */
  protected coverage(skin: PetSkin): string {
    const moods = skin.provided.filter((pose) => (SKIN_STATES as readonly string[]).includes(pose)).length;
    if (moods === 5) return 'wszystkie nastroje';
    return moods ? `${moods} z 5 nastrojów` : 'jedna na wszystko';
  }

  /** RODO: the user can take everything we keep about them — except API keys, which are secrets. */
  protected exportData(): void {
    const data = Object.fromEntries(
      Object.entries(KEYS)
        .filter(([, key]) => key !== KEYS.ai)
        .map(([name, key]) => [name, readJson(key, null)]),
    );
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'pimpek-moje-dane.json' });
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Wipes everything and starts over at onboarding. A full reload keeps every store honest. */
  protected async deleteAll(): Promise<void> {
    clearAll();
    await skinDb.clear().catch(() => undefined);
    location.assign('/witaj');
  }
}
