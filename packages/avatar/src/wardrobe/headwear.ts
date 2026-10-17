/*
 * The headwear past Peek's own three. Each hat is drawn in its own units
 * with its seat at the origin (y up is negative), then scaled with the head
 * (clamp(hw / 88, 0.55, 1.2)) and set on the crown top. A brim's bottom edge
 * bows down the way the crown falls away, so a hat hugs a round head and
 * perches on a narrow tip.
 *
 * Every node exists in every pose, so a live tree keeps its nodes: what
 * comes and goes (a glow, a blink) is an attribute, never a node. Swinging
 * parts turn by the headwear slot's angle about where they attach.
 */

import type { Node } from '../node'
import { el } from '../node'
import type { SwingSpec } from '../physics'
import { INK } from '../tables'
import type { WearCtx, WearDraw } from './context'
import { crownDrop, crownTop, f2, hatScale, inkOf, lineW, swingOf } from './kit'

const CYAN = '#5CF2E8'
const ORANGE = '#F08A24'
const GOLD = '#F2C14E'
const GOLD_DEEP = '#B8860B'
const BEANIE = '#E5677A'
const BEANIE_BAND = '#CC5266'
const WIZARD = '#5B4BB7'
const WIZARD_BRIM = '#4A3C9E'
const PARTY = '#F28C6B'
const PARTY_STRIPE = '#F5C451'
const BERET = '#C9573A'

// the seat sinks into the crown a little; the brim bows at most CAP more,
// so the lowest point stays within 8 frame units of the crown top
const SINK = 2
const CAP = 5.75

type Hat = {
  /** Half-width of the brim, hat units: how far the crown drop is read. */
  bw: number
  parts: (h: HatCtx) => Node[]
}

type HatCtx = {
  ctx: WearCtx
  key: (part: string) => string
  /** The brim's droop at x, hat units. */
  dy: (x: number) => number
  /** A bowed edge from -a to a, through (0, y0); returns [start, control, end]. */
  bowl: (a: number, y0: number) => [string, string, string]
  /** A stroke width on Peek's ramp, in hat units. */
  w: (px: number) => string
  ink: string
  angle: number
  line: Record<string, string>
}

function hat(name: string, spec: Hat): WearDraw {
  return (ctx) => {
    const sh = ctx.sh
    const s = hatScale(sh)
    const top = crownTop(sh)
    const dd = crownDrop(sh, spec.bw * s, CAP) / s
    const dy = (x: number) => dd * (x / spec.bw) ** 2
    const ink = inkOf(ctx)
    const w = (px: number) => f2(lineW(ctx, px) / s)
    const h: HatCtx = {
      ctx,
      key: (part) => `wear.headwear.${name}.${part}`,
      dy,
      bowl: (a, y0) => [
        `${f2(-a)} ${f2(y0 + dy(a))}`,
        `0 ${f2(y0 - dy(a))}`,
        `${f2(a)} ${f2(y0 + dy(a))}`,
      ],
      w,
      ink,
      angle: swingOf(ctx.pose, 'headwear'),
      line: {
        stroke: ink,
        'stroke-width': w(5.25),
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    }
    return [
      el(
        'g',
        `wear.headwear.${name}`,
        {
          transform: `translate(${f2(top.x)} ${f2(top.y + SINK)}) scale(${f2(s)})`,
        },
        spec.parts(h),
      ),
    ]
  }
}

/** A knit cap: a dome over a ribbed band, a pompom that swings. */
const beanie = hat('beanie', {
  bw: 46,
  parts: ({ key, bowl, dy, line, w, ink, angle }) => {
    const [b0, bc, b1] = bowl(46, 0)
    const [t0, tc, t1] = bowl(44, -17)
    return [
      el('path', key('dome'), {
        ...line,
        fill: BEANIE,
        d: `M${f2(-43)} ${f2(dy(43) - 14)}C-43 -46 -26 -60 0 -60C26 -60 43 -46 43 ${f2(dy(43) - 14)}Z`,
      }),
      el('path', key('band'), {
        ...line,
        fill: BEANIE_BAND,
        d: `M${b0}Q${bc} ${b1}L${t1}Q${tc} ${t0}Z`,
      }),
      el('path', key('ribs'), {
        fill: 'none',
        stroke: ink,
        opacity: 0.35,
        'stroke-width': w(2.5),
        'stroke-linecap': 'round',
        d: [-30, -15, 0, 15, 30]
          .map((x) => `M${x} ${f2(dy(x) - 4)}V${f2(dy(x) - 13)}`)
          .join(''),
      }),
      el('g', key('pompom'), { transform: `rotate(${f2(angle)} 0 -58)` }, [
        el('circle', key('pompom.ball'), {
          ...line,
          cx: 0,
          cy: -71,
          r: 12,
          fill: BEANIE,
        }),
        el('path', key('pompom.fluff'), {
          fill: 'none',
          stroke: INK.paper,
          opacity: 0.7,
          'stroke-width': w(2.5),
          'stroke-linecap': 'round',
          d: 'M-6 -76Q-3 -80 1 -79',
        }),
      ]),
    ]
  },
})

/** A thin stalk with a ball on top; the whole stalk swings from its base. */
const antenna = hat('antenna', {
  bw: 14,
  parts: ({ ctx, key, line, w, ink, angle }) => {
    const working = ctx.pose.activity === 'working'
    const lit = working && Math.sin(10 * ctx.pose.t) > 0
    return [
      el('g', key('stalk'), { transform: `rotate(${f2(angle)} 0 -8)` }, [
        // a body-coloured halo keeps the ink stalk off an ink ground
        el('path', key('stalk.halo'), {
          ...line,
          fill: 'none',
          stroke: ctx.ink.body,
          'stroke-width': w(10),
          d: 'M0 -8Q5 -32 0 -56',
        }),
        el('path', key('stalk.line'), {
          ...line,
          fill: 'none',
          'stroke-width': w(4.5),
          d: 'M0 -8Q5 -32 0 -56',
        }),
        el('circle', key('ball'), {
          ...line,
          cx: 0,
          cy: -64,
          r: 10,
          fill: lit ? CYAN : ORANGE,
        }),
        el('circle', key('ball.shine'), {
          cx: -3.5,
          cy: -67.5,
          r: 3,
          fill: INK.paper,
        }),
      ]),
      el('path', key('base'), {
        ...line,
        fill: ink,
        stroke: ctx.ink.body,
        'paint-order': 'stroke',
        d: 'M-14 2C-14 -12 14 -12 14 2Z',
      }),
    ]
  },
})

/** Five points on a band, gold with deep gold detail. */
const crown = hat('crown', {
  bw: 40,
  parts: ({ key, bowl, dy, line, w }) => {
    const [b0, bc, b1] = bowl(38, 0)
    const [m0, mc, m1] = bowl(36, -10)
    const tips: [number, number][] = [
      [-40, -38],
      [-20, -28],
      [0, -46],
      [20, -28],
      [40, -38],
    ]
    return [
      el('path', key('body'), {
        ...line,
        fill: GOLD,
        d: `M${f2(-36)} ${f2(dy(36) - 4)}L-40 -38L-27 -18L-20 -28L-11 -18L0 -46L11 -18L20 -28L27 -18L40 -38L36 ${f2(dy(36) - 4)}L${b1}Q${bc} ${b0}Z`,
      }),
      el('path', key('band'), {
        fill: 'none',
        stroke: GOLD_DEEP,
        'stroke-width': w(3),
        'stroke-linecap': 'round',
        d: `M${m0}Q${mc} ${m1}`,
      }),
      el('g', key('gems'), { fill: GOLD_DEEP }, [
        el('circle', key('gems.0'), { cx: -18, cy: f2(dy(18) - 4), r: 3.5 }),
        el('circle', key('gems.1'), { cx: 0, cy: -4, r: 4.5 }),
        el('circle', key('gems.2'), { cx: 18, cy: f2(dy(18) - 4), r: 3.5 }),
      ]),
      el(
        'g',
        key('tips'),
        { ...line, fill: GOLD, 'stroke-width': w(3.5) },
        tips.map(([x, y], i) =>
          el('circle', key(`tips.${i}`), { cx: x, cy: y - 3, r: 4.5 }),
        ),
      ),
    ]
  },
})

/** A tall cone on a wide brim; the bent tip swings. */
const wizard = hat('wizard', {
  bw: 60,
  parts: ({ key, bowl, dy, line, w, angle }) => {
    const [b0, bc, b1] = bowl(60, 0)
    const [t0, tc, t1] = bowl(52, -9)
    const [g0, gc, g1] = bowl(34, -18)
    return [
      el('path', key('cone'), {
        ...line,
        fill: WIZARD,
        d: `M${f2(-38)} ${f2(dy(38) - 6)}C-30 -34 -8 -64 2 -84L12 -80C18 -56 30 -30 38 ${f2(dy(38) - 6)}Z`,
      }),
      el('g', key('tip'), { transform: `rotate(${f2(angle)} 7 -82)` }, [
        el('path', key('tip.shape'), {
          ...line,
          fill: WIZARD,
          d: 'M2 -84Q8 -104 28 -112Q18 -98 12 -80Z',
        }),
        el('circle', key('tip.star'), {
          cx: 27,
          cy: -112,
          r: 3.5,
          fill: GOLD,
        }),
      ]),
      el('path', key('band'), {
        fill: 'none',
        stroke: GOLD,
        'stroke-width': w(6),
        d: `M${g0}Q${gc} ${g1}`,
      }),
      el('path', key('brim'), {
        ...line,
        fill: WIZARD_BRIM,
        d: `M${b0}Q${bc} ${b1}L${t1}Q${tc} ${t0}Z`,
      }),
      el('path', key('star'), {
        fill: GOLD,
        d: 'M-10 -50L-7.6 -44.6L-2 -44L-6.2 -40.2L-5 -34.6L-10 -37.4L-15 -34.6L-13.8 -40.2L-18 -44L-12.4 -44.6Z',
      }),
      el('circle', key('dot'), { cx: 14, cy: -36, r: 2.5, fill: GOLD }),
    ]
  },
})

/** A striped cone with a pompom that swings on its point. */
const party = hat('party', {
  bw: 30,
  parts: ({ key, bowl, dy, line, angle }) => {
    const [b0, bc, b1] = bowl(30, 0)
    const H = 78
    // the cone's half-width at height y (y up negative)
    const half = (y: number) => 30 * (1 + y / H)
    const stripe = (y0: number, y1: number, tilt: number) =>
      `M${f2(-half(y0 - tilt))} ${f2(y0 - tilt)}L${f2(half(y0 + tilt))} ${f2(y0 + tilt)}L${f2(half(y1 + tilt))} ${f2(y1 + tilt)}L${f2(-half(y1 - tilt))} ${f2(y1 - tilt)}Z`
    return [
      el('path', key('cone'), {
        ...line,
        fill: PARTY,
        d: `M${b0}L0 ${-H}L${b1}Q${bc} ${b0}Z`,
      }),
      el('path', key('stripes'), {
        fill: PARTY_STRIPE,
        d: `${stripe(-14, -24, 4)}${stripe(-40, -49, 3)}`,
      }),
      el('path', key('outline'), {
        ...line,
        fill: 'none',
        d: `M${f2(-30)} ${f2(dy(30))}L0 ${-H}L30 ${f2(dy(30))}`,
      }),
      el('g', key('pompom'), { transform: `rotate(${f2(angle)} 0 ${-H})` }, [
        el('circle', key('pompom.ball'), {
          ...line,
          cx: 0,
          cy: -H - 8,
          r: 8,
          fill: PARTY_STRIPE,
        }),
      ]),
    ]
  },
})

/** A soft disk worn a little to one side, with a stalk on top. */
const beret = hat('beret', {
  bw: 40,
  parts: ({ key, bowl, line, w, ink }) => {
    const [b0, bc, b1] = bowl(36, 0)
    return [
      el('path', key('stalk'), {
        ...line,
        fill: 'none',
        'stroke-width': w(4.5),
        d: 'M4 -36Q3 -44 9 -48',
      }),
      el('path', key('body'), {
        ...line,
        fill: BERET,
        d: `M${b0}C-58 -6 -52 -34 -2 -37C44 -39 72 -18 56 -4C49 3 42 4 ${b1}Q${bc} ${b0}Z`,
      }),
      el('path', key('fold'), {
        fill: 'none',
        stroke: ink,
        opacity: 0.3,
        'stroke-width': w(3),
        'stroke-linecap': 'round',
        d: 'M-30 -8Q6 -16 44 -8',
      }),
    ]
  },
})

/** A pleated paper toque on a band. */
const chef = hat('chef', {
  bw: 34,
  parts: ({ key, bowl, line, w, ink }) => {
    const [b0, bc, b1] = bowl(34, 0)
    const [t0, tc, t1] = bowl(34, -20)
    return [
      el('path', key('puff'), {
        ...line,
        fill: INK.paper,
        d: 'M-33 -16C-54 -20 -58 -54 -34 -58C-32 -80 -8 -84 0 -68C8 -84 32 -80 34 -58C58 -54 54 -20 33 -16Z',
      }),
      el('path', key('band'), {
        ...line,
        fill: INK.paper,
        d: `M${b0}Q${bc} ${b1}L${t1}Q${tc} ${t0}Z`,
      }),
      el('path', key('pleats'), {
        fill: 'none',
        stroke: ink,
        opacity: 0.45,
        'stroke-width': w(2.5),
        'stroke-linecap': 'round',
        d: 'M-14 -24Q-18 -40 -16 -52M14 -24Q18 -40 16 -52M0 -26V-44',
      }),
    ]
  },
})

/** A gold ring floating over the crown, bobbing on the clock. */
const halo: WearDraw = (ctx) => {
  const sh = ctx.sh
  const s = hatScale(sh)
  const top = crownTop(sh)
  const bob = 1.2 * Math.sin(2 * ctx.pose.t)
  const ink = inkOf(ctx)
  const w = (px: number) => f2(lineW(ctx, px) / s)
  const key = (p: string) => `wear.headwear.halo.${p}`
  return [
    el(
      'g',
      'wear.headwear.halo',
      {
        transform: `translate(${f2(top.x)} ${f2(top.y - 30 * s + bob)}) scale(${f2(s)})`,
        fill: 'none',
      },
      [
        el('ellipse', key('rim'), {
          cx: 0,
          cy: 0,
          rx: 36,
          ry: 10,
          stroke: ink,
          'stroke-width': f2(9 + lineW(ctx, 5.25) / s),
        }),
        el('ellipse', key('ring'), {
          cx: 0,
          cy: 0,
          rx: 36,
          ry: 10,
          stroke: GOLD,
          'stroke-width': 9,
        }),
        el('path', key('glint'), {
          stroke: INK.paper,
          opacity: 0.75,
          'stroke-width': w(2.5),
          'stroke-linecap': 'round',
          d: 'M-24 -6Q-12 -10 0 -10',
        }),
      ],
    ),
  ]
}

/**
 * Over-ear headphones: the band spans the head at the eye line and arcs
 * over the crown; the cups glow cyan while listening.
 */
const headphones: WearDraw = (ctx) => {
  const sh = ctx.sh
  const ink = inkOf(ctx)
  const top = crownTop(sh)
  const eyeY = sh.eyes[0][1]
  const half = sh.side + 3
  // cups grow with the head at the eye line, not the crown
  const k = Math.min(1.15, Math.max(0.75, sh.side / 140))
  const cw = 26 * k
  const ch = 52 * k
  const y0 = eyeY - ch / 2 + 6 * k
  // a symmetric cubic peaks at 0.25·y0 + 0.75·c: put its centre on the crown
  const bandW = lineW(ctx, 9)
  const apex = top.y - bandW / 2 + 1
  const c = (apex - 0.25 * y0) / 0.75
  const xl = 170 - half
  const xr = 170 + half
  const band = `M${f2(xl)} ${f2(y0)}C${f2(xl)} ${f2(c)} ${f2(xr)} ${f2(c)} ${f2(xr)} ${f2(y0)}`
  const listening = ctx.pose.activity === 'listening'
  const glow = listening ? 0.6 + 0.4 * Math.sin(6 * ctx.pose.t) : 0
  const key = (p: string) => `wear.headwear.headphones.${p}`
  const cup = (i: number, x: number) => {
    const shape = {
      x: f2(x - cw / 2),
      y: f2(eyeY - ch / 2),
      width: f2(cw),
      height: f2(ch),
      rx: f2(cw * 0.45),
    }
    return el('g', key(`cup${i}.group`), {}, [
      el('rect', key(`cup${i}`), {
        ...shape,
        fill: ORANGE,
        stroke: ink,
        'stroke-width': f2(lineW(ctx, 5.25)),
        'stroke-linejoin': 'round',
      }),
      el('rect', key(`cup${i}.glow`), {
        ...shape,
        fill: CYAN,
        opacity: glow > 0 ? f2(glow) : 0,
      }),
      el('path', key(`cup${i}.pad`), {
        fill: 'none',
        stroke: ink,
        opacity: 0.35,
        'stroke-width': f2(lineW(ctx, 3)),
        'stroke-linecap': 'round',
        d: `M${f2(x)} ${f2(eyeY - ch * 0.26)}V${f2(eyeY + ch * 0.26)}`,
      }),
    ])
  }
  return [
    el('g', 'wear.headwear.headphones', {}, [
      // the same halo as Peek's sprout, so the band reads on an ink ground
      el('path', key('band.halo'), {
        fill: 'none',
        stroke: ctx.ink.body,
        'stroke-width': f2(bandW + lineW(ctx, 6)),
        'stroke-linecap': 'round',
        d: band,
      }),
      el('path', key('band'), {
        fill: 'none',
        stroke: ink,
        'stroke-width': f2(bandW),
        'stroke-linecap': 'round',
        d: band,
      }),
      cup(0, xl),
      cup(1, xr),
    ]),
  ]
}

export const HEADWEAR: Record<
  | 'beanie'
  | 'headphones'
  | 'antenna'
  | 'crown'
  | 'wizard'
  | 'party'
  | 'halo'
  | 'beret'
  | 'chef',
  { draw: WearDraw; physics?: SwingSpec }
> = {
  beanie: {
    draw: beanie,
    physics: { stiffness: 10, damping: 0.22, maxSwing: 16 },
  },
  headphones: { draw: headphones },
  antenna: {
    draw: antenna,
    physics: { stiffness: 9, damping: 0.15, maxSwing: 26 },
  },
  crown: { draw: crown },
  wizard: {
    draw: wizard,
    physics: { stiffness: 8, damping: 0.2, maxSwing: 14 },
  },
  party: {
    draw: party,
    physics: { stiffness: 10, damping: 0.2, maxSwing: 18 },
  },
  halo: { draw: halo },
  beret: { draw: beret },
  chef: { draw: chef },
}
