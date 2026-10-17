/*
 * What every wearable draws from: the face's anchors, the pose, the theme
 * and the body's own transform. Built once per frame inside draw(), so a
 * built-in item and a plugin see the same thing.
 *
 * The registry maps each slot to its drawn items. Peek's own six items stay
 * in draw.ts with their exact drawings; everything past them lives here,
 * built-ins first, plugins after. An item that declares `physics` gets its
 * own spring on a live avatar, found per slot from this registry.
 */

import type { Drawable, Pose } from '../draw'
import type { Node } from '../node'
import type { SwingSpec } from '../physics'
import type { Channel, FaceGeom } from '../tables'
import type { Ink, Theme } from '../themes'
import { HEADWEAR } from './headwear'

export type WearCtx = {
  sh: FaceGeom
  who: Drawable
  pose: Pose
  theme: Theme
  ink: Ink
  /** A persona-adjusted channel (Peek's g()). */
  g: (c: Channel) => number
  /** The transform Peek applies to the body group. */
  bodyTransform: string
  /** Peek's strokeFor(size). */
  stroke: number
  id: string
  size: number
}

export type WearDraw = (ctx: WearCtx) => Node[]
export type Wearable = { draw: WearDraw; physics?: SwingSpec }

/** The slots a spring can drive. The trait rides the body swing, `wob`. */
export type SwingSlot = 'headwear' | 'neckwear' | 'trait'
export type WearSlot = 'headwear' | 'eyewear' | 'neckwear' | 'decor'

export const WEAR: Record<WearSlot, Record<string, Wearable>> = {
  headwear: { ...HEADWEAR },
  eyewear: {},
  neckwear: {},
  decor: {},
}

/** The slots whose items may swing on their own spring. */
const SPRUNG = ['headwear', 'neckwear'] as const

/**
 * The springs an avatar's wardrobe declares, by slot. A slot without one
 * draws on the body swing (`pose.wob`), as Peek's sprout and the trait do.
 */
export function springsOf(
  who: Partial<Record<(typeof SPRUNG)[number], string>>,
): Partial<Record<SwingSlot, SwingSpec>> {
  const out: Partial<Record<SwingSlot, SwingSpec>> = {}
  for (const slot of SPRUNG) {
    const name = who[slot]
    const spec = name ? WEAR[slot][name]?.physics : undefined
    if (spec) out[slot] = spec
  }
  return out
}
