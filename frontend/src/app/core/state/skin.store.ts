import { computed, effect, Injectable, signal } from '@angular/core';
import { PetSkin } from '../models/skin.model';
import { readSkinPack, SkinPackError } from '../services/skin-pack';
import { skinDb } from '../../shared/skin-db';
import { KEYS, readJson, writeJson } from '../../shared/storage';

const MAX_PACK_MB = 30;

/** Looks the user uploaded for Pimpek, and which one he's wearing. */
@Injectable({ providedIn: 'root' })
export class SkinStore {
  readonly skins = signal<readonly PetSkin[]>([]);
  /** null is the built-in, hand-drawn Pimpek. */
  readonly activeId = signal<string | null>(readJson<string | null>(KEYS.skin, null));
  readonly active = computed(() => this.skins().find((s) => s.id === this.activeId()));

  constructor() {
    effect(() => writeJson(KEYS.skin, this.activeId()));
    void this.restore();
  }

  /** Unpacks the zip, keeps it and puts it on. Throws SkinPackError with a message for the user. */
  async add(file: File): Promise<PetSkin> {
    if (file.size > MAX_PACK_MB * 1024 * 1024) {
      throw new SkinPackError(`Paczka jest za duża — maksymalnie ${MAX_PACK_MB} MB.`);
    }
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const skin = readSkinPack(id, file.name, new Uint8Array(await file.arrayBuffer()));
    // Without storage (private mode) the skin still works until the next reload.
    await skinDb
      .put({ id, fileName: file.name, zip: file, addedAt: new Date().toISOString() })
      .catch(() => undefined);
    this.skins.update((list) => [...list, skin]);
    this.activeId.set(id);
    return skin;
  }

  select(id: string | null): void {
    this.activeId.set(id);
  }

  async remove(id: string): Promise<void> {
    this.skins().find((s) => s.id === id)?.urls.forEach((url) => URL.revokeObjectURL(url));
    this.skins.update((list) => list.filter((s) => s.id !== id));
    if (this.activeId() === id) this.activeId.set(null);
    await skinDb.delete(id).catch(() => undefined);
  }

  private async restore(): Promise<void> {
    const stored = await skinDb.all().catch(() => []);
    const skins: PetSkin[] = [];
    for (const pack of stored.sort((a, b) => a.addedAt.localeCompare(b.addedAt))) {
      try {
        skins.push(readSkinPack(pack.id, pack.fileName, new Uint8Array(await pack.zip.arrayBuffer())));
      } catch {
        // A pack that no longer unpacks is skipped; Pimpek falls back to his own look.
      }
    }
    this.skins.update((added) => [...skins, ...added]);
  }
}
