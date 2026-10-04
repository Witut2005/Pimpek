import { strFromU8, unzipSync } from 'fflate';
import { AvatarState } from '../models/check-in.model';
import { PetSkin, SkinClip, SkinPose, TouchPose } from '../models/skin.model';

export const SKIN_STATES: readonly AvatarState[] = ['happy', 'neutral', 'sleepy', 'sad', 'sick'];
const TOUCHES: readonly TouchPose[] = ['petted', 'tickled', 'hugged'];
const POSES: readonly SkinPose[] = [...SKIN_STATES, 'celebrate', ...TOUCHES];

const IMAGE_TYPES: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  apng: 'image/apng',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

const DEFAULT_FPS = 12;
const MANIFEST = 'manifest.json';

/**
 * Optional manifest.json at the root of the pack. Without it, files are matched by name:
 * `happy.svg`, `sad.json` (Lottie), or a `sleepy/` folder of numbered frames.
 */
interface Manifest {
  name?: string;
  /** Frames per second for folders of frames. */
  fps?: number;
  /** Which state stands in for the ones the pack doesn't draw. Defaults to neutral. */
  fallback?: AvatarState;
  /** Set to false when the pack's own animation already moves the whole body. */
  motion?: boolean;
  /** Pose → file or folder inside the pack, for packs that don't follow the naming. */
  states?: Partial<Record<SkinPose, string>>;
}

/** A problem with the pack itself; the message is meant for the user. */
export class SkinPackError extends Error {}

type Files = Record<string, Uint8Array>;

function extension(path: string): string {
  return path.slice(path.lastIndexOf('.') + 1).toLowerCase();
}

function stem(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name).toLowerCase();
}

const isImage = (path: string) => extension(path) in IMAGE_TYPES;
const isClipFile = (path: string) =>
  isImage(path) || (extension(path) === 'json' && path.toLowerCase() !== MANIFEST);

/** Shallow paths first, then natural order, so `frame2` comes before `frame10`. */
function byPath(a: string, b: string): number {
  return a.split('/').length - b.split('/').length || a.localeCompare(b, undefined, { numeric: true });
}

function unpack(zip: Uint8Array): Files {
  let files: Files;
  try {
    files = unzipSync(zip, {
      filter: (f) =>
        !f.name.endsWith('/') &&
        !f.name.split('/').some((part) => part.startsWith('.') || part === '__MACOSX'),
    });
  } catch {
    throw new SkinPackError('To nie wygląda na plik .zip.');
  }

  // Zipping a folder nests everything inside it — unwrap so paths start at the pack's root.
  let paths = Object.keys(files);
  while (paths.length && paths.every((p) => p.includes('/'))) {
    const roots = new Set(paths.map((p) => p.slice(0, p.indexOf('/'))));
    const [root] = roots;
    if (roots.size > 1 || POSES.includes(root.toLowerCase() as SkinPose)) break;
    files = Object.fromEntries(Object.entries(files).map(([p, data]) => [p.slice(root.length + 1), data]));
    paths = Object.keys(files);
  }
  return files;
}

function readManifest(files: Files): Manifest {
  const path = Object.keys(files).find((p) => p.toLowerCase() === MANIFEST);
  if (!path) return {};
  try {
    const manifest = JSON.parse(strFromU8(files[path]));
    return manifest && typeof manifest === 'object' ? manifest : {};
  } catch {
    throw new SkinPackError('Plik manifest.json ma błąd składni.');
  }
}

/** Unpacks a skin pack into playable clips. Throws SkinPackError when there's nothing to play. */
export function readSkinPack(id: string, fileName: string, zip: Uint8Array): PetSkin {
  const files = unpack(zip);
  const paths = Object.keys(files).sort(byPath);
  const manifest = readManifest(files);
  const fps = Math.min(60, Math.max(1, Number(manifest.fps) || DEFAULT_FPS));

  const urls: string[] = [];
  const toUrl = (path: string) => {
    const url = URL.createObjectURL(new Blob([files[path] as Uint8Array<ArrayBuffer>], { type: IMAGE_TYPES[extension(path)] }));
    urls.push(url);
    return url;
  };

  const lottieAt = (path: string): SkinClip => {
    let data;
    try {
      data = JSON.parse(strFromU8(files[path]));
    } catch {
      throw new SkinPackError(`${path} nie jest poprawnym plikiem JSON.`);
    }
    if (!Array.isArray(data?.layers)) {
      throw new SkinPackError(`${path} nie wygląda na animację Lottie.`);
    }
    // Exports with separate images point at files next to the JSON; serve them from the pack.
    const dir = path.slice(0, path.lastIndexOf('/') + 1);
    for (const asset of data.assets ?? []) {
      if (typeof asset.p !== 'string' || asset.e === 1 || asset.p.startsWith('data:')) continue;
      const target = `${dir}${asset.u ?? ''}${asset.p}`.replace(/(^|\/)\.\//g, '$1');
      if (files[target]) {
        asset.u = '';
        asset.p = toUrl(target);
      }
    }
    return { kind: 'lottie', data };
  };

  const clipAt = (path: string): SkinClip | undefined => {
    if (files[path]) {
      if (extension(path) === 'json') return lottieAt(path);
      return isImage(path) ? { kind: 'image', url: toUrl(path) } : undefined;
    }
    const folder = path.replace(/\/+$/, '') + '/';
    const frames = paths.filter((p) => p.startsWith(folder) && isImage(p)).sort(byPath);
    if (frames.length === 1) return { kind: 'image', url: toUrl(frames[0]) };
    return frames.length ? { kind: 'frames', urls: frames.map(toUrl), fps } : undefined;
  };

  /** `happy.svg` anywhere in the pack, or a folder called `happy/` holding frames. */
  const detect = (pose: SkinPose): string | undefined => {
    const file = paths.find((p) => stem(p) === pose && isClipFile(p));
    if (file) return file;
    const frame = paths.find((p) => isImage(p) && p.toLowerCase().split('/').at(-2) === pose);
    return frame?.slice(0, frame.lastIndexOf('/'));
  };

  const found: Partial<Record<SkinPose, SkinClip>> = {};
  for (const pose of POSES) {
    const wanted = manifest.states?.[pose];
    const clip = clipAt(wanted ?? detect(pose) ?? '');
    if (wanted && !clip) {
      throw new SkinPackError(`manifest.json wskazuje „${wanted}” dla stanu ${pose}, a w paczce tego nie ma.`);
    }
    if (clip) found[pose] = clip;
  }

  // A pack with one unnamed animation still works — it simply plays in every state.
  const anyFile = paths.find(isClipFile);
  const base =
    found[manifest.fallback ?? 'neutral'] ??
    found.neutral ??
    Object.values(found)[0] ??
    (anyFile ? clipAt(anyFile) : undefined);
  if (!base) {
    throw new SkinPackError('Nie ma tu żadnej animacji. Pimpek rozumie SVG, PNG, GIF, WebP i Lottie (.json).');
  }

  return {
    id,
    name: (manifest.name?.trim() || fileName.replace(/\.zip$/i, '')).slice(0, 32),
    clips: {
      ...(Object.fromEntries(SKIN_STATES.map((s) => [s, found[s] ?? base])) as Record<AvatarState, SkinClip>),
      celebrate: found.celebrate,
      petted: found.petted,
      tickled: found.tickled,
      hugged: found.hugged,
    },
    provided: POSES.filter((pose) => found[pose]),
    motion: manifest.motion ?? true,
    urls,
  };
}
