/*
 * Face decorations: the public `face` option. Drawn in frame units on the
 * cheeks and above the mouth, where draw() puts them (the cheeks spread with
 * the persona and lift as the face lowers), sized by the cheek. They paint
 * after the cheeks and the mouth, before any eyewear.
 *
 * Every node exists in every pose, so a live tree keeps its nodes.
 */

import { clamp } from '../geom'
import type { Node } from '../node'
import { el } from '../node'
import { INK } from '../tables'
import type { WearCtx, WearDraw } from './context'
import { f2, inkOf, lineW } from './kit'

const FRECKLE = '#8A5A3B'
const BANDAID = '#E9C29B'
const BANDAID_PAD = '#D4A57A'
const GOLD = '#F2C14E'

/** Cheek `i` this frame, where draw() puts the blush, and its size. */
function cheek(ctx: WearCtx, i: 0 | 1) {
  const { sh, g } = ctx
  const [cx, cy] = sh.cheeks[i]
  const spread = ctx.who.persona.spread
  const lower = clamp(g('lower'), 0, 1)
  return {
    x: cx + (i === 0 ? -1 : 1) * spread * 0.6,
    y: cy - lower * 4,
    s: sh.crx / 11.25,
  }
}

const outline = (ctx: WearCtx, px: number) => ({
  stroke: inkOf(ctx),
  'stroke-width': f2(lineW(ctx, px)),
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
})

const root = (name: string, attrs: Record<string, string>, kids: Node[]) => [
  el('g', `wear.decor.${name}`, attrs, kids),
]

/** Three freckles on each cheek. */
const freckles: WearDraw = (ctx) => {
  const key = (p: string) => `wear.decor.freckles.${p}`
  return root(
    'freckles',
    {},
    ([0, 1] as const).map((i) => {
      const { x, y, s } = cheek(ctx, i)
      const dots: [number, number][] = [
        [-10, -3],
        [0, 4],
        [10, -2],
      ]
      return el(
        'g',
        key(`cheek${i}`),
        {
          transform: `translate(${f2(x)} ${f2(y)}) scale(${f2(s)})`,
          fill: FRECKLE,
          opacity: '0.7',
        },
        dots.map(([dx, dy], j) =>
          el('circle', key(`cheek${i}.${j}`), {
            cx: i === 0 ? -dx : dx,
            cy: dy,
            r: 3.6,
          }),
        ),
      )
    }),
  )
}

/** An ink curl sitting just above the mouth. */
const mustache: WearDraw = (ctx) => {
  const { sh, g } = ctx
  const m = sh.mouth
  const key = (p: string) => `wear.decor.mustache.${p}`
  const kb = 4 / 3
  // the upper lip's top: an open or raised mouth lifts it
  const lip = m.y + g('my') + Math.min(0, g('mt'), g('mb')) * m.d * kb
  const s = clamp(m.w / 16, 0.8, 1.2)
  const y = lip - m.sw * ctx.stroke - 8 * s
  const ink = inkOf(ctx)
  // it rides the mouth: the persona's mouth skew (mk) turns both about the
  // mouth's own origin, so a lopsided grin carries its mustache with it
  const mk = g('mk')
  const mx = m.x + g('mx')
  const my = m.y + g('my')
  const at =
    mk === 0
      ? `translate(${f2(mx)} ${f2(y)})`
      : `translate(${f2(mx)} ${f2(my)}) rotate(${f2(mk)}) translate(0 ${f2(y - my)})`
  return root(
    'mustache',
    {
      transform: `${at} scale(${f2(s)})`,
    },
    [
      el('path', key('curl'), {
        fill: ink,
        stroke: ink,
        'stroke-width': f2(lineW(ctx, 1.5) / s),
        'stroke-linejoin': 'round',
        d: 'M0 -3C-6 -9 -18 -10 -26 -4C-31 0 -36 -1 -37 -6C-40 1 -33 8 -22 7C-12 6 -5 4 0 2C5 4 12 6 22 7C33 8 40 1 37 -6C36 -1 31 0 26 -4C18 -10 6 -9 0 -3Z',
      }),
      el('path', key('sheen'), {
        fill: 'none',
        stroke: INK.paper,
        opacity: '0.3',
        'stroke-width': f2(lineW(ctx, 2) / s),
        'stroke-linecap': 'round',
        d: 'M-8 -4Q-15 -6 -21 -3M8 -4Q15 -6 21 -3',
      }),
    ],
  )
}

/** A plaster across the right cheek. */
const bandaid: WearDraw = (ctx) => {
  const { x, y, s } = cheek(ctx, 1)
  const key = (p: string) => `wear.decor.bandaid.${p}`
  const line = outline(ctx, 2.5)
  return root(
    'bandaid',
    {
      transform: `translate(${f2(x)} ${f2(y)}) rotate(-24) scale(${f2(s)})`,
    },
    [
      el('rect', key('strip'), {
        ...line,
        'stroke-width': f2(lineW(ctx, 2.5) / s),
        x: -20,
        y: -7.5,
        width: 40,
        height: 15,
        rx: 7.5,
        fill: BANDAID,
      }),
      el('rect', key('pad'), {
        x: -7,
        y: -5,
        width: 14,
        height: 10,
        rx: 2,
        fill: BANDAID_PAD,
      }),
      el('path', key('holes'), {
        fill: 'none',
        stroke: BANDAID_PAD,
        'stroke-width': f2(lineW(ctx, 2) / s),
        'stroke-linecap': 'round',
        d: 'M-14 -2v0M-14 2v0M14 -2v0M14 2v0',
      }),
    ],
  )
}

/** A gold star stuck on the left cheek. */
const sticker: WearDraw = (ctx) => {
  const { x, y, s } = cheek(ctx, 0)
  const key = (p: string) => `wear.decor.sticker.${p}`
  const R = 14
  const r = 6.2
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = ((-90 + i * 36) * Math.PI) / 180
    const rr = i % 2 === 0 ? R : r
    return `${f2(rr * Math.cos(a))} ${f2(rr * Math.sin(a))}`
  })
  return root(
    'sticker',
    {
      transform: `translate(${f2(x)} ${f2(y)}) rotate(-12) scale(${f2(s)})`,
    },
    [
      el('path', key('star'), {
        ...outline(ctx, 2.5),
        'stroke-width': f2(lineW(ctx, 2.5) / s),
        fill: GOLD,
        d: `M${pts.join('L')}Z`,
      }),
      el('path', key('shine'), {
        fill: 'none',
        stroke: INK.paper,
        opacity: '0.8',
        'stroke-width': f2(lineW(ctx, 2) / s),
        'stroke-linecap': 'round',
        d: 'M-4 -6l2 -3',
      }),
    ],
  )
}

export const DECOR: Record<
  'freckles' | 'mustache' | 'bandaid' | 'sticker',
  { draw: WearDraw }
> = {
  freckles: { draw: freckles },
  mustache: { draw: mustache },
  bandaid: { draw: bandaid },
  sticker: { draw: sticker },
}
