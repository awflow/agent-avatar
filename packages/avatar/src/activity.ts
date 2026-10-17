/*
 * The activity layer: what an agent is doing, drawn next to Peek's 11
 * expressions. An activity overlays a few channels on an expression's table
 * (blend) and adds a small additive loop on top (activityLoop). Both are pure
 * and deterministic: same inputs, same numbers.
 */

import type { FxKind } from './fx'
import { type Channels, EXPRESSIONS, type Expression } from './tables'

export type { FxKind }

export type Activity =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'working'
  | 'speaking'
  | 'waiting'
  | 'done'
  | 'error'
  | 'sleeping'
  | 'offline'

export const ACTIVITIES: Record<
  Activity,
  { set: Partial<Channels>; fx: FxKind[]; lockGaze: boolean }
> = {
  idle: { set: {}, fx: [], lockGaze: false },
  listening: {
    set: { lid: 0, eyeS: 1.06, browY: -4, rot: 5, mw: 0.5, mb: 0.3, gx: -0.3 },
    fx: ['rings'],
    lockGaze: false,
  },
  thinking: {
    set: {
      gx: -0.35,
      gy: -0.6,
      browAsym: 7,
      browArch: 0.8,
      mw: 0.45,
      mt: -0.1,
      mb: 0.15,
      mk: 6,
      lid: 0.05,
    },
    fx: ['bubbles'],
    lockGaze: true,
  },
  working: {
    set: {
      gy: 0.35,
      browY: 2,
      lid: 0.22,
      mw: 0.5,
      mt: 0,
      mb: 0.12,
      browArch: 0.2,
    },
    fx: ['spinner'],
    lockGaze: true,
  },
  speaking: {
    set: { lid: 0.05, browY: -2, mw: 0.8 },
    fx: ['waves'],
    lockGaze: false,
  },
  waiting: {
    set: {
      lid: 0,
      eyeS: 1.06,
      browY: -6,
      browArch: 0.9,
      gx: 0,
      gy: 0,
      mw: 0.5,
      mt: -0.2,
      mb: 0.25,
    },
    fx: ['ask'],
    lockGaze: true,
  },
  done: {
    set: {
      lid: 0,
      lower: 0.45,
      shine: 1,
      browY: -5,
      browArch: 1,
      mw: 1,
      mb: 1,
      blush: 1,
      hair: 0.6,
    },
    fx: ['sparkles'],
    lockGaze: false,
  },
  error: {
    set: {
      lid: 0.18,
      browTilt: 14,
      browY: 2,
      browArch: 0,
      mw: 0.7,
      mt: -0.35,
      mb: -0.15,
      my: 3,
      gy: 0.3,
    },
    fx: ['sweat'],
    lockGaze: false,
  },
  sleeping: {
    set: {
      lid: 1,
      lidTilt: 4,
      gy: 0.5,
      browY: 5,
      browArch: 0.15,
      mw: 0.35,
      mt: -0.2,
      mb: 0.3,
      alt: -0.9,
      rot: -3,
      hair: -1,
    },
    fx: ['zzz'],
    lockGaze: true,
  },
  offline: {
    set: { lid: 0.62, gy: 0.4, browY: 3, mw: 0.4, mt: 0, mb: 0.05, dim: 1 },
    fx: [],
    lockGaze: true,
  },
}

/** Narrow anything to a known activity; unknown values are idle. */
export function activityOf(v: unknown): Activity {
  return typeof v === 'string' && Object.hasOwn(ACTIVITIES, v)
    ? (v as Activity)
    : 'idle'
}

const MIXED = ['browTilt', 'browArch', 'blush', 'lidTilt'] as const

/**
 * An expression's channels with an activity laid over them. On a non-normal
 * expression the brow tilt and arch, the blush and the lid tilt are the mean
 * of both, so a happy face that is working still smiles a little.
 */
export function blend(expression: Expression, activity: Activity): Channels {
  const e = EXPRESSIONS[expression]
  const { set } = ACTIVITIES[activity]
  const out: Channels = { ...e, ...set }
  if (expression !== 'normal' && activity !== 'idle') {
    for (const k of MIXED) out[k] = (e[k] + (set[k] ?? e[k])) / 2
  }
  // an activity that sets no mouth bottom leaves the expression's mouth alone
  if (set.mb === undefined) {
    out.mt = set.mt ?? e.mt
    out.mb = e.mb
  }
  return out
}

const sin = Math.sin
const mod = (a: number, b: number) => ((a % b) + b) % b
// the shiver's x is in Peek frame units, 3.4 per channel unit
const FRAME_X = 3.4

/**
 * The small motion an activity adds on top of its pose, additive on the
 * channel values. `t` is seconds, `phase` offsets the loop per avatar.
 */
export function activityLoop(
  activity: Activity,
  t: number,
  phase: number,
): Partial<Channels> {
  const ph = phase
  const o: Partial<Channels> = {}
  const add = (k: keyof Channels, v: number) => {
    o[k] = (o[k] ?? 0) + v
  }
  switch (activity) {
    case 'thinking':
      add('gx', 0.28 * sin(0.9 * t + ph))
      add('rot', 2 * sin(0.7 * t))
      add('sy', 0.01 * sin(1.6 * t))
      break
    case 'working':
      add('gx', 0.55 * sin(3.1 * t + ph))
      add('alt', 0.05 * Math.abs(sin(9 * t)))
      add('rot', 1.2 * sin(4.5 * t))
      break
    case 'sleeping':
      add('sy', 0.03 * sin(1.1 * t + ph))
      add('alt', 0.06 * sin(1.1 * t + ph))
      break
    case 'offline':
      break
    default:
      add('sy', 0.012 * sin(2.1 * t + ph))
  }
  if (activity === 'speaking') {
    const m = 0.5 + 0.5 * sin(13 * t + ph) * sin(3.7 * t + 1.3)
    add('mb', 0.85 * m)
    add('mt', -0.35 * m)
    add('alt', 0.03 * sin(6 * t))
  } else if (activity === 'listening') {
    add('rot', 1.5 * sin(1.3 * t))
  } else if (activity === 'waiting') {
    add('alt', 0.16 * Math.abs(sin(3.4 * t)))
    add('sy', 0.02 * sin(6.8 * t))
  } else if (activity === 'done') {
    // a hop in the first 30% of every 2.4 s: squash, rise, land
    const c = mod(t, 2.4)
    if (c < 0.72) {
      const q = c / 0.72
      add('alt', 0.9 * sin(Math.PI * q))
      if (q < 0.2) add('sy', -0.06)
      else if (q > 0.8) add('sy', 0.03)
    }
  } else if (activity === 'error') {
    const p = mod(t, 2.2)
    if (p < 0.5) add('x', FRAME_X * 1.1 * sin(60 * p) * (1 - p / 0.5))
  }
  return o
}
