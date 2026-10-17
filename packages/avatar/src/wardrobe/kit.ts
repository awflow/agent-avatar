/*
 * Small helpers the wardrobe drawings share: a slot's swing angle, Peek's
 * stroke ramp, and where a hat sits on the crown.
 */

import type { Pose } from '../draw'
import { clamp, seat } from '../geom'
import type { FaceGeom } from '../tables'
import type { SwingSlot, WearCtx } from './context'

export const f2 = (v: number) => String(Math.round(v * 100) / 100)

/** A slot's swing angle this frame, in degrees. */
export const swingOf = (pose: Pose, slot: SwingSlot) =>
  pose.swing?.[slot] ?? pose.wob

/** A stroke width on Peek's ramp, capped so small items stay items. */
export const lineW = (ctx: WearCtx, px: number) =>
  px * Math.min(ctx.stroke, 1.6)

/** The theme's ink for this avatar: outlines and strokes. */
export const inkOf = (ctx: WearCtx) => ctx.theme.ink(ctx.ink)

/** Hats scale with the head: clamp(hw / 88, 0.55, 1.2). */
export const hatScale = (sh: FaceGeom) => clamp(sh.hw / 88, 0.55, 1.2)

/** The crown's top point, where the outward normal points straight up. */
export const crownTop = (sh: FaceGeom) => seat(sh.crown, 0, 0)

/**
 * How far the crown falls away below its top at a horizontal offset `dx`
 * (frame units), the larger of the two sides. A hat's brim follows this so
 * it hugs a round head; capped so on a narrow tip the hat perches instead
 * of sliding down the slopes.
 */
export function crownDrop(sh: FaceGeom, dx: number, cap: number): number {
  const top = crownTop(sh)
  let drop = 0
  for (const side of [-1, 1]) {
    let lo = 0
    let hi = 400
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2
      const p = seat(sh.crown, 0, side * mid)
      if (side * (p.x - top.x) < dx) lo = mid
      else hi = mid
    }
    drop = Math.max(drop, seat(sh.crown, 0, (side * (lo + hi)) / 2).y - top.y)
  }
  return clamp(drop, 0, cap)
}
