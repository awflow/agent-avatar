/*
 * Reactions: short one-shot gestures (a nod, a wink, a hop) played on top of
 * whatever the face is doing. Each is a duration and a pure function of its
 * progress p (0..1) to channel deltas, added after the springs; the blush is
 * the one channel that takes the max instead of the sum. A reaction may also
 * pour an overlay into the fx pool for its whole run.
 */

import type { FxKind } from './fx'
import type { Channels } from './tables'

export type Reaction =
  | 'nod'
  | 'shake'
  | 'wink'
  | 'hop'
  | 'spin'
  | 'shiver'
  | 'gasp'
  | 'love'
  | 'giggle'
  | 'celebrate'

export type ReactionSpec = {
  /** Seconds. */
  dur: number
  /** Channel deltas at progress p, 0..1. */
  at: (p: number) => Partial<Channels>
  /** An overlay drawn for the whole reaction, its progress p. */
  fx?: FxKind
}

const s = Math.sin
const PI = Math.PI
// x is in Peek frame units, 3.4 per channel unit
const FRAME_X = 3.4
const easeInOutQuad = (p: number) =>
  p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2

export const REACTIONS: Record<Reaction, ReactionSpec> = {
  nod: {
    dur: 0.9,
    at: (p) => ({
      gy: 0.5 * s(2 * PI * p),
      alt: -0.18 * Math.abs(s(2 * PI * p)),
    }),
  },
  shake: {
    dur: 0.9,
    at: (p) => ({
      x: FRAME_X * 4 * s(6 * PI * p) * (1 - p),
      gx: 0.5 * s(6 * PI * p) * (1 - p),
    }),
  },
  wink: {
    dur: 0.7,
    at: (p) => ({
      winkR: s(PI * p),
      mb: 0.5 * s(PI * p),
      browAsym: -6 * s(PI * p),
    }),
  },
  hop: {
    dur: 0.8,
    at: (p) => {
      const edge = p < 0.12 || p > 0.88
      // the landing squash lets go over the last 4% so the hop ends on rest
      const k = Math.min(1, Math.max(0, (1 - p) / 0.04))
      return {
        alt: 1.6 * s(PI * p),
        sy: edge ? -0.08 * (p > 0.88 ? k : 1) : 0.04,
        sx: edge ? 0.06 * (p > 0.88 ? k : 1) : -0.02,
      }
    },
  },
  spin: {
    dur: 1.1,
    at: (p) => ({ rot: 360 * easeInOutQuad(p), alt: 0.6 * s(PI * p) }),
  },
  shiver: {
    dur: 1,
    at: (p) => ({
      x: FRAME_X * 1.4 * s(90 * p) * (1 - p),
      sy: -0.02,
      lid: 0.15,
      browTilt: 10,
    }),
  },
  gasp: {
    dur: 1.1,
    at: (p) => {
      const k =
        s((Math.min(1, 2.5 * p) * PI) / 2) * (1 - Math.max(0, (p - 0.7) / 0.3))
      return {
        eyeS: 0.25 * k,
        mt: -0.6 * k,
        mb: 0.7 * k,
        browY: -12 * k,
        alt: 0.3 * k,
        pupil: -0.3 * k,
      }
    },
  },
  love: {
    dur: 1.8,
    at: (p) => ({
      blush: 1,
      lower: 0.4 * s(PI * p),
      mb: 0.5 * s(PI * p),
      alt: 0.2 * s(PI * p),
    }),
    fx: 'hearts',
  },
  giggle: {
    dur: 1.2,
    at: (p) => ({
      rot: 6 * s(8 * PI * p) * (1 - p),
      lower: 0.45 * s(PI * p),
      mb: 0.8 * s(PI * p),
      blush: 0.8,
    }),
  },
  celebrate: {
    dur: 1.8,
    at: (p) => ({
      alt: 1.3 * Math.abs(s(2 * PI * p)) * (1 - p / 2),
      lower: 0.45,
      mb: 1,
      blush: 1,
    }),
    fx: 'confetti',
  },
}

/** Narrow anything to a known reaction, or null. */
export function reactionOf(v: unknown): Reaction | null {
  return typeof v === 'string' && Object.hasOwn(REACTIONS, v)
    ? (v as Reaction)
    : null
}
