/*
 * Characters: a whole mascot drawn on the package's rig. A character plugin
 * draws its body in body space, in three layers (behind the body, the body,
 * in front of the face), and may draw its own eyes, brows and mouth. Every
 * motion stays the rig's: draw() hands each drawing the pose channels, the
 * clock, the springs and the size tier, and the character only turns them
 * into shapes. Its geometry is a body shape's, so wardrobe, props, overlays
 * and rings place on it as on any face.
 *
 * Nodes land under `plugin.<name>.*`, as every plugin's do. A drawing that
 * throws or yields non-finite numbers is skipped for that render and
 * reported once: its groups stay, hidden and empty, and a failing body
 * shows the geometry's plain silhouette instead, so the avatar never
 * vanishes.
 */

import type { Activity } from './activity'
import { el, type Node } from './node'
import type { SwingSpec } from './physics'
import { safeNodes, skipPlugin } from './plugins'
import type { Reaction } from './reactions'
import type { Brows, Cheeks, Expression, Eyes, FaceGeom, Mouth } from './tables'
import type { WearCtx } from './wardrobe/context'

/** What a character's draw returns, every array in body coordinates. */
export type CharacterLayers = {
  /** Gradients, clip paths and filters, poured into the svg's defs. */
  defs?: Node[]
  /** Behind the body: tufts, tails, a glow. */
  back?: Node[]
  /** The body itself, under the face. */
  body: Node[]
  /** In front of the face, under the wardrobe: wings, glasses, hands. */
  front?: Node[]
}

/** What every character drawing reads. */
export type CharacterCtx = WearCtx & {
  activity: Activity
  expression: Expression
  /**
   * Level of detail from the rendered size, fixed for a live avatar: 2 draws
   * everything, 1 is below 44px, 0 below 24px (eyes and body only). A
   * character should keep its node set per tier, never per pose.
   */
  tier: 0 | 1 | 2
  /** The theme's feature ink for this avatar. */
  line: string
  /** Breathing, -1..1 on the rig's breath clock; 0 on a static frame. */
  breath: number
  /**
   * Degrees: the character's own spring when it declares `physics`, else
   * the body swing (`pose.wob`). Both are driven by the body's acceleration.
   */
  swing: number
  /** The trait's lag behind the body, frame units. */
  lag: number
  /** The reaction playing, if any, and its progress 0..1. */
  reaction: Reaction | null
  reactionP: number
}

/** One eye, as the rig has it this frame. Drawn about the eye's centre. */
export type EyeState = {
  index: 0 | 1
  /** -1 for the left eye, 1 for the right. */
  side: -1 | 1
  /** The socket's half sizes, already grown by `eyeS`. */
  rx: number
  ry: number
  /** 0 open to 1 shut: the lid, its asymmetry, a wink and the blink. */
  lid: number
  /** 0..1, the lower lid pushing up: the smiling squint. */
  lower: number
  /** Degrees the upper lid tilts, signed for this side. */
  tilt: number
  /** Pupil scale, 1 at rest. */
  pupil: number
  /** 0..1, how bright the shine is. */
  shine: number
  /** Where the eye looks, -1.1..1.1 each way. */
  gx: number
  gy: number
  /** 0..1, how much a smiling eye has turned into an upturned arc. */
  happy: number
}

/**
 * One brow, drawn in a group already moved to the brow's spot and turned by
 * its tilt (clamped inside the outline, as built-in brows are).
 */
export type BrowState = {
  index: 0 | 1
  side: -1 | 1
  /** Half length, frame units. */
  hw: number
  /** The arch's control depth: negative bows up. */
  arch: number
  /** Stroke weight on the size ramp. */
  weight: number
  /** Degrees of tilt, signed for this side (already applied). */
  tilt: number
}

/**
 * The mouth, drawn in a group already moved to the mouth's spot and skewed
 * by `mk`. Lip offsets are frame units: negative is up.
 */
export type MouthState = {
  /** Half width. */
  w: number
  /** The upper and lower lip's depth at the middle. */
  top: number
  bottom: number
  /** The geometry's mouth depth unit (`mouth.d`). */
  d: number
  /** 0..1, how far the lips are parted. */
  open: number
  /** 0..1 from lip-sync, -1 for none. */
  voice: number
}

export type CharacterPlugin = {
  kind: 'character'
  name: string
  /** The anchors: eyes, brows, mouth, cheeks, crown, sides, neck. */
  geom: FaceGeom
  /** Built-in parts this character always wears unless an option says. */
  parts?: Partial<{ eyes: Eyes; brows: Brows; mouth: Mouth; cheeks: Cheeks }>
  /** Its own spring, read as `ctx.swing` (and `pose.swing.character`). */
  physics?: SwingSpec
  draw: (ctx: CharacterCtx) => CharacterLayers
  /** Draws one eye in place of the built-in one. */
  eye?: (ctx: CharacterCtx, eye: EyeState) => Node[]
  /** Draws one brow in place of the built-in one. */
  brow?: (ctx: CharacterCtx, brow: BrowState) => Node[]
  /** Draws the mouth in place of the built-in one. */
  mouth?: (ctx: CharacterCtx, mouth: MouthState) => Node[]
}

/** A character's layers this frame, each in its keyed group. */
export function drawCharacter(
  p: CharacterPlugin,
  ctx: CharacterCtx,
): { defs: Node[]; back: Node; body: Node; front: Node; ok: boolean } {
  const key = `plugin.${p.name}`
  try {
    const out = p.draw(ctx)
    if (!out || typeof out !== 'object')
      throw new Error('draw must return layers')
    const seen = new Set<string>()
    const pre = `${key}.`
    const layer = (v: unknown) => safeNodes(v ?? [], pre, seen)
    return {
      defs: layer(out.defs),
      back: el('g', `${key}.back`, {}, layer(out.back)),
      body: el('g', `${key}.body`, {}, layer(out.body)),
      front: el('g', `${key}.front`, {}, layer(out.front)),
      ok: true,
    }
  } catch (e) {
    skipPlugin(p, e)
    const hidden = (k: string) => el('g', `${key}.${k}`, { opacity: 0 })
    return {
      defs: [],
      back: hidden('back'),
      body: hidden('body'),
      front: hidden('front'),
      ok: false,
    }
  }
}

/**
 * One of a character's face parts (`eye0`, `brow1`, `mouth`) in its keyed
 * group; hidden and empty when the drawing fails.
 */
export function characterPart(
  p: CharacterPlugin,
  part: string,
  run: () => unknown,
): Node {
  const key = `plugin.${p.name}.${part}`
  try {
    return el('g', key, {}, safeNodes(run(), `${key}.`, new Set()))
  } catch (e) {
    skipPlugin(p, e)
    return el('g', key, { opacity: 0 })
  }
}
