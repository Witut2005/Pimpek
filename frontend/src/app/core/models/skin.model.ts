import { AvatarState } from './check-in.model';

/** One looping animation: a (possibly animated) image, a flipbook of frames or a Lottie file. */
export type SkinClip =
  | { kind: 'image'; url: string }
  | { kind: 'frames'; urls: readonly string[]; fps: number }
  | { kind: 'lottie'; data: object };

/** Avatar states plus a one-off clip played while Pimpek celebrates. */
export type SkinPose = AvatarState | 'celebrate';

/** A look uploaded by the user as a .zip pack, already unpacked into playable clips. */
export interface PetSkin {
  id: string;
  name: string;
  /** Every state has a clip — the ones missing from the pack borrow the fallback's. */
  clips: Record<AvatarState, SkinClip> & { celebrate?: SkinClip };
  /** States the pack really drew, so the picker can show what's borrowed. */
  provided: readonly SkinPose[];
  /** Whether Pimpek's bounce and sway play on top of the pack's own animation. */
  motion: boolean;
  /** Object URLs to revoke once the skin is removed. */
  urls: readonly string[];
}
