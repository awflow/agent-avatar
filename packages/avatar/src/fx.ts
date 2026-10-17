/*
 * The fx layer: small overlays drawn next to the face in frame space, for
 * activities (bubbles while thinking, a spinner while working) and for
 * reactions (hearts, confetti). Every overlay is a list of plain path shapes
 * from (kind, t, progress, anchors), pure and deterministic, so draw() can
 * pour them into a fixed pool of nodes that a live tree keeps frame to frame.
 *
 * Sizes come from the 100-unit prototype, scaled by 3.4 into the frame.
 */

import { mulberry32 } from './identity'
import { INK } from './tables'

/** Overlay kinds drawn by the fx layer. Append-only. */
export type FxKind =
  | 'bubbles'
  | 'zzz'
  | 'sparkles'
  | 'rings'
  | 'spinner'
  | 'waves'
  | 'ask'
  | 'sweat'
  | 'hearts'
  | 'confetti'

export const FX_KINDS: readonly FxKind[] = [
  'bubbles',
  'zzz',
  'sparkles',
  'rings',
  'spinner',
  'waves',
  'ask',
  'sweat',
  'hearts',
  'confetti',
]

/** How many fx nodes a tree carries from LOD tier 2: `fx.0` to `fx.23`. */
export const FX_POOL = 24

/** Below LOD tier 2 only the ask badge draws: 3 nodes, `fx.0` to `fx.2`. */
export const FX_POOL_SMALL = 3

export type FxShape = {
  d: string
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  transform: string
}

/**
 * Where overlays sit, in frame units: the head's centre line, the top of the
 * crown, the head's half-width at the eye line, the eye line and the mouth.
 */
export type FxAnchor = {
  headX: number
  headTop: number
  side: number
  eyeY: number
  mouthY: number
}

const S = 3.4
const ORANGE = '#F08A24'
const BLUE = '#7DB7E8'
const PINK = '#E5677A'
const GOLD = '#F2B544'
const CONFETTI = [ORANGE, PINK, BLUE, GOLD, '#6CC49A'] as const
const RAD = Math.PI / 180

const r2 = (v: number) => Math.round(v * 100) / 100
const r3 = (v: number) => Math.round(v * 1000) / 1000
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const frac = (v: number) => v - Math.floor(v)
// fades in over the first fifth of a cycle and out over the last
const fade = (q: number, k = 5) => clamp(Math.min(k * q, k * (1 - q)), 0, 1)

const circle = (r: number) =>
  `M${r2(-r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0Z`
// an arc around the origin, angles in degrees clockwise from 3 o'clock
const arc = (r: number, a0: number, a1: number) => {
  const x0 = r * Math.cos(a0 * RAD)
  const y0 = r * Math.sin(a0 * RAD)
  const x1 = r * Math.cos(a1 * RAD)
  const y1 = r * Math.sin(a1 * RAD)
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  return `M${r2(x0)} ${r2(y0)}A${r2(r)} ${r2(r)} 0 ${large} 1 ${r2(x1)} ${r2(y1)}`
}
const at = (x: number, y: number, rot = 0, sc = 1) =>
  `translate(${r2(x)} ${r2(y)})${rot ? ` rotate(${r2(rot)})` : ''}${sc !== 1 ? ` scale(${r3(sc)})` : ''}`

const shape = (s: Partial<FxShape> & { d: string }): FxShape => ({
  fill: 'none',
  stroke: 'none',
  strokeWidth: 0,
  transform: '',
  ...s,
  opacity: r3(clamp(s.opacity ?? 1, 0, 1)),
})

// a four-point star with pinched sides, radius 1
const STAR =
  'M0 -1Q0.14 -0.14 1 0Q0.14 0.14 0 1Q-0.14 0.14 -1 0Q-0.14 -0.14 0 -1Z'
// a heart about 2 wide, its point at the bottom
const HEART =
  'M0 0.75C-1 0.1 -1.3 -0.45 -0.9 -0.85C-0.55 -1.2 -0.1 -1 0 -0.7C0.1 -1 0.55 -1.2 0.9 -0.85C1.3 -0.45 1 0.1 0 0.75Z'
// a drop about 1.4 wide, pointing up
const DROP =
  'M0 -1.25C0.35 -0.6 0.7 -0.25 0.7 0.2A0.7 0.7 0 0 1 -0.7 0.2C-0.7 -0.25 -0.35 -0.6 0 -1.25Z'
// the ask badge: a rounded speech bubble with its tail toward the head
const BUBBLE =
  'M-13 -20H13Q25 -20 25 -8V8Q25 20 13 20H-4L-17 31L-12 20H-13Q-25 20 -25 8V-8Q-25 -20 -13 -20Z'
const QUESTION = 'M-7 -8Q-7 -15 0 -15Q7 -15 7 -8Q7 -3 0 0V4'

/**
 * The shapes of one overlay. `t` is seconds on the loop clock, `p` the 0..1
 * progress of a reaction (hearts, confetti). `ink` is the face ink, used by
 * marks that sit on the body; `onDark` says the ground behind is dark. `k`
 * grows the ask badge, which is the one overlay kept at small sizes.
 */
export function fxShapes(
  kind: FxKind,
  t: number,
  p: number,
  a: FxAnchor,
  ink: string,
  onDark: boolean,
  k = 1,
): FxShape[] {
  const ground = onDark ? INK.bone : INK.ink
  const hx = a.headX
  const top = a.headTop
  const sd = a.side
  const out: FxShape[] = []
  switch (kind) {
    case 'bubbles': {
      // thought bubbles float up and right from the crown, growing as they go
      for (let i = 0; i < 3; i++) {
        const q = frac(0.9 * t + i / 3)
        const r = (1.4 + 3.3 * q) * S
        out.push(
          shape({
            d: circle(r),
            fill: onDark ? INK.bone : INK.paper,
            stroke: ground,
            strokeWidth: 1.2 * S,
            opacity: fade(q),
            transform: at(
              hx + sd * 0.42 + q * 14 * S,
              top - 2 * S - q * 21 * S,
            ),
          }),
        )
      }
      break
    }
    case 'zzz': {
      for (let i = 0; i < 3; i++) {
        const q = frac(0.45 * t + i / 3)
        const z = (1.6 + 2 * q) * S
        out.push(
          shape({
            d: `M${r2(-z)} ${r2(-z)}H${r2(z)}L${r2(-z)} ${r2(z)}H${r2(z)}`,
            stroke: ground,
            strokeWidth: 1.1 * S,
            opacity: Math.sin(Math.PI * q),
            transform: at(
              hx + sd * 0.3 + q * 16 * S,
              top - 3 * S - q * 30 * S,
              -8,
            ),
          }),
        )
      }
      break
    }
    case 'sparkles': {
      const pts: [number, number][] = [
        [-0.95 * sd, 6 * S],
        [0.98 * sd, -1 * S],
        [0.6 * sd, -12 * S],
        [-0.5 * sd, -10 * S],
      ]
      pts.forEach(([dx, dy], i) => {
        const tw = Math.max(0, Math.sin(4 * t + 1.7 * i))
        out.push(
          shape({
            d: STAR,
            fill: GOLD,
            opacity: tw > 0 ? 1 : 0,
            transform: at(hx + dx, top + dy, 0, (5.4 + i * 0.6) * S * tw),
          }),
        )
      })
      break
    }
    case 'rings': {
      // sound coming in: arcs open to the left of the face, growing, fading
      for (let i = 0; i < 2; i++) {
        const q = frac(0.8 * t + i / 2)
        out.push(
          shape({
            d: arc((6 + 8 * q) * S, 140, 220),
            stroke: ground,
            strokeWidth: 1.2 * S,
            opacity: Math.min(1, 6 * q) * (1 - q),
            transform: at(hx - sd * 0.82, a.eyeY),
          }),
        )
      }
      break
    }
    case 'spinner': {
      const x = Math.min(hx + sd * 0.72, 330)
      const y = Math.max(top + 2 * S, -6)
      out.push(
        shape({
          d: circle(6.6 * S),
          fill: onDark ? INK.ink : INK.paper,
          transform: at(x, y),
        }),
        shape({
          d: circle(4.4 * S),
          stroke: ground,
          strokeWidth: 1.4 * S,
          opacity: 0.18,
          transform: at(x, y),
        }),
        shape({
          d: arc(4.4 * S, -145, -35),
          stroke: ORANGE,
          strokeWidth: 1.4 * S,
          transform: at(x, y, (300 * t) % 360),
        }),
      )
      break
    }
    case 'waves': {
      // speech: two arcs off the right of the mouth, pulsing
      for (let i = 0; i < 2; i++)
        out.push(
          shape({
            d: arc((4 + 3.2 * i) * S, -40, 40),
            stroke: ink,
            strokeWidth: 1.1 * S,
            opacity: 0.5 + 0.5 * Math.sin(9 * t - 1.2 * i),
            transform: at(hx + 6 * S, a.mouthY),
          }),
        )
      break
    }
    case 'ask': {
      const x = Math.min(hx + sd * 0.7, 340 - 26 * k)
      const y =
        Math.max(top - 4 * S, -30 + 22 * k) + 1.4 * S * Math.sin(3.4 * t)
      out.push(
        shape({ d: BUBBLE, fill: ORANGE, transform: at(x, y, 0, k) }),
        shape({
          d: QUESTION,
          stroke: '#FFFFFF',
          strokeWidth: 5.5,
          transform: at(x, y, 0, k),
        }),
        shape({
          d: circle(3.4),
          fill: '#FFFFFF',
          transform: at(x, y + 12 * k, 0, k),
        }),
      )
      break
    }
    case 'sweat': {
      // a drop slides down the temple and fades
      const q = frac(0.6 * t)
      const x = hx + sd * 0.62
      const y = a.eyeY - 14 * S + q * 9 * S
      const o = fade(q, 4)
      out.push(
        shape({
          d: DROP,
          fill: BLUE,
          stroke: ground,
          strokeWidth: 0.07,
          opacity: o,
          transform: at(x, y, 0, 5 * S),
        }),
        shape({
          d: circle(0.18),
          fill: '#FFFFFF',
          opacity: o * 0.8,
          transform: at(x - 1.1 * S, y + 1.2 * S, 0, 5 * S),
        }),
      )
      break
    }
    case 'hearts': {
      const xs = [-0.55, 0.1, 0.65]
      for (let i = 0; i < 3; i++) {
        const q = clamp((p - 0.12 * i) / 0.76, 0, 1)
        out.push(
          shape({
            d: HEART,
            fill: PINK,
            opacity: Math.sin(Math.PI * q),
            transform: at(
              hx + xs[i]! * sd + 2 * S * Math.sin(6 * q + i),
              top + 6 * S - q * (26 + 6 * i) * S,
              (i - 1) * 12,
              (0.6 + 0.6 * q) * 4 * S,
            ),
          }),
        )
      }
      break
    }
    case 'confetti': {
      // the same sixteen pieces every time: a fixed seed, drawn in order
      const rnd = mulberry32(0x5eed)
      const o = p <= 0 ? 0 : 1 - clamp((p - 0.8) / 0.2, 0, 1)
      for (let i = 0; i < 16; i++) {
        const x0 = hx - 180 + rnd() * 360
        const y0 = -40 - rnd() * 60
        const fall = 300 + rnd() * 140
        const spin = (rnd() * 2 - 1) * 540
        const rot0 = rnd() * 360
        out.push(
          shape({
            d: 'M-4 -2H4V2H-4Z',
            fill: CONFETTI[i % CONFETTI.length]!,
            opacity: o,
            transform: at(
              x0 + 8 * Math.sin(8 * p + i),
              y0 + p * fall,
              rot0 + p * spin,
              1.5,
            ),
          }),
        )
      }
      break
    }
  }
  return out.slice(0, FX_POOL)
}
