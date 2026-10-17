/*
 * Held props. A prop floats at the bottom-right in frame space, never in the
 * body group: it bobs and rocks on the wardrobe clock and may answer the
 * activity (the bulb lights while thinking or done, the coffee steams). Under
 * full framing it rides the framing transform with the fx, so it follows the
 * body. Each drawing is the mock's, in its 100-unit space, scaled ×3.4 about
 * the prop's centre.
 *
 * Every node exists in every pose, so a live tree keeps its nodes: the bulb's
 * halo stays as an invisible node while unlit. Below 44px draw() leaves the
 * prop out entirely.
 */

import { el, type Node } from '../node'
import type { WearCtx, WearDraw } from './context'
import { f2, inkOf, lineW } from './kit'

const PAPER = '#FFFDF8'
const GLASS = '#BDE1E5'
const WOOD = '#6B4E2E'
const PENCIL = '#F5C451'
const PENCIL_EDGE = '#B8860B'
const PENCIL_WOOD = '#F1CDBF'
const ERASER = '#E5677A'
const COFFEE = '#8A5A3B'
const STEAM = '#9E958A'
const GLOW = '#F5C451'
const LIT = '#F9D976'
const COVER = '#4F86F7'
const STEEL = '#B8B2A7'
const STEEL_EDGE = '#5F5A52'

/** The prop's centre in frame space: the mock's (82, 78) × 3.4. */
export const PROP_AT = { x: 279, y: 265 } as const
const UNIT = 3.4

const f3 = (v: number) => String(Math.round(v * 1000) / 1000)
/** An ellipse as one path, as the mock draws it. */
const E = (cx: number, cy: number, rx: number, ry: number) =>
  `M${f2(cx - rx)} ${f2(cy)}a${f2(rx)} ${f2(ry)} 0 1 0 ${f2(2 * rx)} 0a${f2(rx)} ${f2(ry)} 0 1 0 ${f2(-2 * rx)} 0Z`
const op = (v: number) => (v < 1 ? f3(Math.max(0, v)) : undefined)

type Paint = { fill?: string; stroke?: string; sw?: number; opacity?: number }
type Part = (ctx: WearCtx, key: (p: string) => string) => Node[]

/** A path in mock units; the stroke follows Peek's ramp. */
function path(ctx: WearCtx, key: string, d: string, p: Paint): Node {
  return el('path', key, {
    d,
    fill: p.fill ?? 'none',
    stroke: p.stroke,
    'stroke-width': p.stroke ? f2(lineW(ctx, p.sw ?? 1)) : undefined,
    'stroke-linecap': p.stroke ? 'round' : undefined,
    'stroke-linejoin': p.stroke ? 'round' : undefined,
    opacity: p.opacity === undefined ? undefined : op(p.opacity),
  })
}

function prop(name: string, parts: Part): WearDraw {
  return (ctx) => {
    const t = ctx.t
    const bob = 4 * Math.sin(2.2 * t + 1)
    const rot = -10 + 4 * Math.sin(1.4 * t)
    return [
      el(
        'g',
        `wear.prop.${name}`,
        {
          transform: `translate(${PROP_AT.x} ${f2(PROP_AT.y + bob)}) rotate(${f2(rot)}) scale(${UNIT})`,
        },
        parts(ctx, (p) => `wear.prop.${name}.${p}`),
      ),
    ]
  }
}

const magnifier = prop('magnifier', (ctx, key) => [
  path(ctx, key('handle'), 'M4 4L11 11', { stroke: WOOD, sw: 3 }),
  path(ctx, key('lens'), E(0, 0, 6, 6), { fill: GLASS, opacity: 0.55 }),
  path(ctx, key('rim'), E(0, 0, 6, 6), { stroke: inkOf(ctx), sw: 1.8 }),
  path(ctx, key('glint'), 'M-3 -2A4 4 0 0 1 0 -4', {
    stroke: '#FFFFFF',
    sw: 1.1,
  }),
])

const pencil = prop('pencil', (ctx, key) => [
  path(ctx, key('body'), 'M-9 6L5 -8L9 -4L-5 10Z', {
    fill: PENCIL,
    stroke: PENCIL_EDGE,
    sw: 0.7,
  }),
  path(ctx, key('wood'), 'M-9 6L-11 12L-5 10Z', {
    fill: PENCIL_WOOD,
    stroke: PENCIL_EDGE,
    sw: 0.7,
  }),
  path(ctx, key('tip'), 'M-11 12L-10.2 9.6L-8.6 11.2Z', { fill: inkOf(ctx) }),
  path(ctx, key('eraser'), 'M5 -8L7 -10L11 -6L9 -4Z', { fill: ERASER }),
])

const coffee = prop('coffee', (ctx, key) => {
  const ink = inkOf(ctx)
  // the steam loop, 0..1: rises 6 units and fades out, then starts again
  const st = (((0.8 * ctx.t) % 1) + 1) % 1
  return [
    path(
      ctx,
      key('steam'),
      `M-2 ${f2(-8 - st * 6)}q-2 -2 0 -4M2 ${f2(-7 - st * 6)}q2 -2 0 -4`,
      {
        stroke: STEAM,
        sw: 0.9,
        opacity: 1 - st,
      },
    ),
    path(ctx, key('cup'), 'M-6 -4h11v9a4 4 0 0 1 -4 4h-3a4 4 0 0 1 -4 -4z', {
      fill: PAPER,
      stroke: ink,
      sw: 1,
    }),
    path(ctx, key('handle'), 'M5 -1a3 3 0 0 1 0 6', { stroke: ink, sw: 1 }),
    path(ctx, key('coffee'), 'M-5 -2h9', { stroke: COFFEE, sw: 1.6 }),
  ]
})

const bulb = prop('bulb', (ctx, key) => {
  const ink = inkOf(ctx)
  const act = ctx.pose.activity
  const lit = act === 'thinking' || act === 'done'
  return [
    path(ctx, key('halo'), E(0, -2, 10, 10), {
      fill: GLOW,
      opacity: lit ? 0.3 + 0.15 * Math.sin(5 * ctx.t) : 0,
    }),
    path(
      ctx,
      key('glass'),
      'M0 -9a6 6 0 0 1 4 10.5v2.5h-8v-2.5A6 6 0 0 1 0 -9z',
      {
        fill: lit ? LIT : PAPER,
        stroke: ink,
        sw: 1,
      },
    ),
    path(ctx, key('base'), 'M-3 6h6M-2.5 8h5', { stroke: ink, sw: 1 }),
  ]
})

const book = prop('book', (ctx, key) => {
  const ink = inkOf(ctx)
  return [
    path(
      ctx,
      key('pages'),
      'M0 -4C-4 -6 -9 -6 -12 -4V8C-9 6 -4 6 0 8C4 6 9 6 12 8V-4C9 -6 4 -6 0 -4Z',
      {
        fill: PAPER,
        stroke: ink,
        sw: 1,
      },
    ),
    path(ctx, key('lines'), 'M0 -4V8M-9 -1H-3M-9 2H-3M3 -1H9M3 2H8', {
      stroke: ink,
      sw: 0.6,
      opacity: 0.6,
    }),
    path(
      ctx,
      key('cover'),
      'M-12 8C-9 6 -4 6 0 8C4 6 9 6 12 8V10C9 8 4 8 0 10C-4 8 -9 8 -12 10Z',
      {
        fill: COVER,
      },
    ),
  ]
})

const wrench = prop('wrench', (ctx, key) => [
  path(
    ctx,
    key('head'),
    'M-8 8L3 -3A5 5 0 0 1 9 -9L6 -6L7 -3L10 -2L13 -5A5 5 0 0 1 6 1L-5 12Z',
    {
      fill: STEEL,
      stroke: STEEL_EDGE,
      sw: 0.9,
    },
  ),
])

export type PropName =
  | 'magnifier'
  | 'pencil'
  | 'coffee'
  | 'bulb'
  | 'book'
  | 'wrench'

/** The held props by name. Plugins (Task 5) add theirs after these. */
export const PROPS: Record<PropName, { draw: WearDraw }> = {
  magnifier: { draw: magnifier },
  pencil: { draw: pencil },
  coffee: { draw: coffee },
  bulb: { draw: bulb },
  book: { draw: book },
  wrench: { draw: wrench },
}
