/*
 * The neckwear past Peek's tie. Each item hangs from the neck line
 * (`sh.neck`, following the mouth as it moves), drawn in frame units with
 * the knot at the origin. It sits in the body group like the tie, so it
 * moves and tilts with the body and the floor clips it just as it clips the
 * creature. An open mouth pushes it down, never under the lips.
 *
 * Every node exists in every pose, so a live tree keeps its nodes. The
 * scarf's tail swings on the neckwear slot's own spring, about its knot.
 */

import { clamp } from '../geom'
import type { Node } from '../node'
import { el } from '../node'
import type { SwingSpec } from '../physics'
import { INK } from '../tables'
import type { WearCtx, WearDraw } from './context'
import { f2, inkOf, lineW, swingOf } from './kit'

const RED = '#E5412D'
const RED_DEEP = '#B8321F'
const SCARF = '#F0A54A'
const SCARF_DEEP = '#D98A2E'
const WHITE = '#FFFFFF'
const PEARL = '#FBF6EC'
const BLUE = '#3B82F6'
const ORANGE = '#F08A24'

/** Where the neckwear hangs this frame: the neck line, clear of the lips. */
export function neckAt(ctx: WearCtx) {
  const { sh, g } = ctx
  const m = sh.mouth
  const my = g('my')
  const lips = Math.max(0, g('mt'), g('mb')) * m.d * (4 / 3)
  const below = m.y + my + lips + m.sw * ctx.stroke + 2
  return { x: m.x, y: Math.max(sh.neck + my, below) }
}

const outline = (ctx: WearCtx, px: number) => ({
  stroke: inkOf(ctx),
  'stroke-width': f2(lineW(ctx, px)),
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
})

function item(
  name: string,
  parts: (ctx: WearCtx, key: (p: string) => string) => Node[],
): WearDraw {
  return (ctx) => {
    const { x, y } = neckAt(ctx)
    return [
      el(
        'g',
        `wear.neckwear.${name}`,
        { transform: `translate(${f2(x)} ${f2(y)})` },
        parts(ctx, (p) => `wear.neckwear.${name}.${p}`),
      ),
    ]
  }
}

/** Two red wings pinched by a knot. */
const bowtie = item('bowtie', (ctx, key) => {
  const line = outline(ctx, 4)
  return [
    el('path', key('wings'), {
      ...line,
      fill: RED,
      d: 'M-5 -4L-27 -15Q-33 0 -27 15L-5 4ZM5 -4L27 -15Q33 0 27 15L5 4Z',
    }),
    el('path', key('folds'), {
      fill: 'none',
      stroke: RED_DEEP,
      'stroke-width': f2(lineW(ctx, 2.5)),
      'stroke-linecap': 'round',
      d: 'M-12 -5Q-17 0 -12 5M12 -5Q17 0 12 5',
    }),
    el('rect', key('knot'), {
      ...line,
      x: -7,
      y: -8,
      width: 14,
      height: 16,
      rx: 4,
      fill: RED_DEEP,
    }),
  ]
})

/** A striped band round the neck, a tail that swings from the knot. */
const scarf = item('scarf', (ctx, key) => {
  const half = Math.min(ctx.sh.side, 115)
  const line = outline(ctx, 4)
  const angle = swingOf(ctx.pose, 'neckwear')
  // the band dips toward the middle, as a scarf wraps a round neck
  const top = (x: number) => -10 + 14 * (1 - (x / half) ** 2)
  const stripes = [-0.62, -0.2, 0.62]
    .map((u) => {
      const x = u * half
      return `M${f2(x - 3)} ${f2(top(x) + 3)}L${f2(x + 3)} ${f2(top(x) + 19)}`
    })
    .join('')
  // the knot sits right of centre; the tail hangs from it
  const kx = half * 0.32
  const ky = top(kx) + 12
  return [
    el('path', key('band'), {
      ...line,
      fill: SCARF,
      d: `M${f2(-half)} -10Q0 ${f2(top(0) * 2 + 10)} ${f2(half)} -10L${f2(half)} 12Q0 ${f2(top(0) * 2 + 32)} ${f2(-half)} 12Z`,
    }),
    el('path', key('stripes'), {
      fill: 'none',
      stroke: WHITE,
      'stroke-width': f2(lineW(ctx, 5)),
      'stroke-linecap': 'round',
      d: stripes,
    }),
    el(
      'g',
      key('tail'),
      { transform: `rotate(${f2(angle)} ${f2(kx)} ${f2(ky)})` },
      [
        el('path', key('tail.cloth'), {
          ...line,
          fill: SCARF,
          d: `M${f2(kx - 11)} ${f2(ky)}L${f2(kx - 15)} ${f2(ky + 58)}L${f2(kx + 9)} ${f2(ky + 62)}L${f2(kx + 11)} ${f2(ky)}Z`,
        }),
        el('path', key('tail.stripes'), {
          fill: 'none',
          stroke: WHITE,
          'stroke-width': f2(lineW(ctx, 5)),
          'stroke-linecap': 'round',
          d: `M${f2(kx - 12)} ${f2(ky + 22)}L${f2(kx + 10)} ${f2(ky + 24)}M${f2(kx - 13)} ${f2(ky + 40)}L${f2(kx + 9)} ${f2(ky + 43)}`,
        }),
        el('path', key('tail.fringe'), {
          fill: 'none',
          stroke: SCARF_DEEP,
          'stroke-width': f2(lineW(ctx, 3)),
          'stroke-linecap': 'round',
          d: [-11, -4, 3]
            .map((dx) => `M${f2(kx + dx)} ${f2(ky + 62 + dx * 0.15)}l-1 7`)
            .join(''),
        }),
      ],
    ),
    el('ellipse', key('knot'), {
      ...line,
      cx: f2(kx),
      cy: f2(ky),
      rx: 13,
      ry: 10,
      fill: SCARF_DEEP,
    }),
  ]
})

/** Nine pearls on a string, hung in an arc. */
const necklace = item('necklace', (ctx, key) => {
  // wide and shallow, so it reads as a string across the chest
  const hw = clamp(ctx.sh.side * 0.62, 50, 80)
  const dip = 28
  const at = (t: number) => ({
    x: -hw + 2 * hw * t,
    y: 2 + 2 * t * (1 - t) * (dip * 2),
  })
  return [
    el('path', key('string'), {
      fill: 'none',
      ...outline(ctx, 2.5),
      d: `M${f2(-hw)} 2Q0 ${f2(dip * 2 + 2)} ${f2(hw)} 2`,
    }),
    el(
      'g',
      key('pearls'),
      { fill: PEARL, ...outline(ctx, 2) },
      Array.from({ length: 9 }, (_, i) => {
        const p = at(0.1 + i * 0.1)
        return el('circle', key(`pearls.${i}`), {
          cx: f2(p.x),
          cy: f2(p.y),
          r: i === 4 ? 7 : 5.25,
        })
      }),
    ),
    el('path', key('shine'), {
      fill: 'none',
      stroke: INK.paper,
      'stroke-width': f2(lineW(ctx, 2)),
      'stroke-linecap': 'round',
      d: Array.from({ length: 9 }, (_, i) => {
        const p = at(0.1 + i * 0.1)
        return `M${f2(p.x - 2.5)} ${f2(p.y - 1.5)}l1.5 -1.5`
      }).join(''),
    }),
  ]
})

/** A blue lanyard and a white card with orange lines. */
const badge = item('badge', (ctx, key) => {
  const hw = clamp(ctx.sh.side * 0.3, 24, 40)
  const line = outline(ctx, 3.5)
  // short, so the card clears the floor on a peek portrait
  return [
    el('path', key('lanyard'), {
      fill: 'none',
      stroke: BLUE,
      'stroke-width': f2(lineW(ctx, 6)),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      d: `M${f2(-hw)} -6L-5 16M${f2(hw)} -6L5 16`,
    }),
    el('rect', key('clip'), {
      ...line,
      x: -6,
      y: 12,
      width: 12,
      height: 9,
      rx: 2,
      fill: BLUE,
    }),
    el('rect', key('card'), {
      ...line,
      x: -17,
      y: 19,
      width: 34,
      height: 38,
      rx: 5,
      fill: WHITE,
    }),
    el('path', key('lines'), {
      fill: 'none',
      stroke: ORANGE,
      'stroke-width': f2(lineW(ctx, 4)),
      'stroke-linecap': 'round',
      d: 'M-9 32H9M-9 41H9M-9 50H1',
    }),
  ]
})

export const NECKWEAR: Record<
  'bowtie' | 'scarf' | 'necklace' | 'badge',
  { draw: WearDraw; physics?: SwingSpec }
> = {
  bowtie: { draw: bowtie },
  scarf: {
    draw: scarf,
    physics: { stiffness: 9, damping: 0.2, maxSwing: 20 },
  },
  necklace: { draw: necklace },
  badge: { draw: badge },
}
