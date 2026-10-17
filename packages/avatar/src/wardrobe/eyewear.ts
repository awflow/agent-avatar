/*
 * The eyewear past Peek's glasses and sunglasses. Drawn in frame units on
 * the eye sockets (where the eyes sit, spread by the persona, grown with the
 * eye scale), never on the pupils, so the gaze stays free. The visor is the
 * one that replaces the eyes: draw() leaves them out and the visor glows
 * where they would look, squashed by the same lids.
 *
 * Every node exists in every pose, so a live tree keeps its nodes: the
 * glow's squash is an attribute, never a node.
 */

import { clamp, depth } from '../geom'
import type { Node } from '../node'
import { el } from '../node'
import { INK } from '../tables'
import type { Wearable, WearCtx, WearDraw } from './context'
import { f2, inkOf, lineW, memoOf } from './kit'

const GOLD = '#C9952A'
const VISOR = '#23252F'
const CYAN = '#5CF2E8'
const ROSE = '#E5677A'
// the visor glow moves 3 mock units a side, 3.4 frame units to the mock unit
const GLOW_TRAVEL = 3 * 3.4

/** The eye sockets this frame: centres, the eye's own radii, the lids. */
function sockets(ctx: WearCtx) {
  const { sh, g, pose } = ctx
  const spread = ctx.who.persona.spread
  const eyeS = g('eyeS')
  const ey = sh.eyes[0][1]
  const eyR = sh.eyes[1][1]
  const lid0 = g('lid')
  const asym = g('lidAsym')
  // the same lids draw() closes the eyes with: asymmetry, wink, then blink
  const lids = [0, 1].map((i) => {
    let lid = clamp(lid0 + (i === 0 ? asym : -asym * 0.3), 0, 1)
    if (i === 1) lid = Math.max(lid, clamp(pose.winkR ?? 0, 0, 1))
    return lid + (1 - lid) * pose.blink
  }) as [number, number]
  return {
    l: sh.eyes[0][0] - spread,
    r: sh.eyes[1][0] + spread,
    ey,
    eyR,
    rx: sh.rx * eyeS,
    ry: sh.ry * eyeS,
    lids,
  }
}

const line = (ctx: WearCtx, px: number, stroke = inkOf(ctx)) => ({
  fill: 'none',
  stroke,
  'stroke-width': f2(lineW(ctx, px)),
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
})

/** Walks from (x, y) along (dx, dy) until just inside the crown's edge. */
function toEdge(ctx: WearCtx, x: number, y: number, dx: number, dy: number) {
  const L = Math.hypot(dx, dy)
  const ux = dx / L
  const uy = dy / L
  const reach = memoOf(ctx.sh.crown, `edge:${x},${y},${dx},${dy}`, () => {
    let lo = 0
    let hi = 220
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2
      if (depth(ctx.sh.crown, x + ux * mid, y + uy * mid) < -3) lo = mid
      else hi = mid
    }
    return lo
  })
  return { x: x + ux * reach, y: y + uy * reach }
}

function group(name: string, parts: Node[]): Node[] {
  return [el('g', `wear.eyewear.${name}`, {}, parts)]
}

/** A gold ring on the right eye, a chain looping down to the side. */
const monocle: WearDraw = (ctx) => {
  const { r: cx, ey, rx, ry } = sockets(ctx)
  const key = (p: string) => `wear.eyewear.monocle.${p}`
  const R = Math.max(rx, ry) + 8
  // the chain leaves the ring low on its outer side and loops to the edge
  const a = (60 * Math.PI) / 180
  const x0 = cx + R * Math.cos(a)
  const y0 = ey + R * Math.sin(a)
  const x1 = Math.min(cx + R + 16, 170 + ctx.sh.side - 6)
  const y1 = ey + R + 34
  return group('monocle', [
    el('path', key('chain'), {
      ...line(ctx, 2.5, GOLD),
      'stroke-dasharray': `${f2(lineW(ctx, 1))} ${f2(lineW(ctx, 4))}`,
      d: `M${f2(x0)} ${f2(y0)}Q${f2(x0 - 6)} ${f2(y1 + 14)} ${f2(x1)} ${f2(y1)}`,
    }),
    el('circle', key('lens'), {
      cx: f2(cx),
      cy: f2(ey),
      r: f2(R),
      fill: INK.paper,
      opacity: 0.14,
    }),
    el('circle', key('rim'), {
      ...line(ctx, 8.5),
      cx: f2(cx),
      cy: f2(ey),
      r: f2(R),
    }),
    el('circle', key('ring'), {
      ...line(ctx, 5.25, GOLD),
      cx: f2(cx),
      cy: f2(ey),
      r: f2(R),
    }),
    el('path', key('glint'), {
      ...line(ctx, 3, INK.paper),
      d: `M${f2(cx - R * 0.62)} ${f2(ey - R * 0.38)}Q${f2(cx - R * 0.5)} ${f2(ey - R * 0.68)} ${f2(cx - R * 0.18)} ${f2(ey - R * 0.76)}`,
    }),
  ])
}

/** A dark band over both eyes; two cyan glows look and blink for them. */
const visor: WearDraw = (ctx) => {
  const { l, r, ey, eyR, rx, ry, lids } = sockets(ctx)
  const key = (p: string) => `wear.eyewear.visor.${p}`
  const h = clamp(ry * 1.7, 30, 54)
  const half = Math.min((r - l) / 2 + rx + 12, ctx.sh.side - 4)
  // level eyes (every built-in face) keep the band upright on the centre
  // line, as ever. A shape whose eyes sit at different heights tilts the
  // band through both and centres it between them, the glows on their own
  const tilt = eyR !== ey
  const cx0 = tilt ? (l + r) / 2 : 170
  const cy0 = tilt ? (ey + eyR) / 2 : ey
  const x0 = cx0 - half
  const gx = clamp(ctx.g('gx'), -1.1, 1.1)
  const gr = clamp(rx * 0.36, 6, 11)
  const band: Node[] = [
    el('rect', key('band'), {
      x: f2(x0),
      y: f2(cy0 - h / 2),
      width: f2(half * 2),
      height: f2(h),
      rx: f2(h / 2),
      fill: VISOR,
      stroke: inkOf(ctx),
      'stroke-width': f2(lineW(ctx, 3)),
    }),
    el('path', key('sheen'), {
      ...line(ctx, 3, INK.paper),
      opacity: 0.22,
      d: `M${f2(x0 + h * 0.45)} ${f2(cy0 - h * 0.28)}H${f2(cx0 + half - h * 0.45)}`,
    }),
  ]
  const parts: Node[] = tilt
    ? [
        el(
          'g',
          key('tilt'),
          {
            transform: `rotate(${f2((Math.atan2(eyR - ey, r - l) * 180) / Math.PI)} ${f2(cx0)} ${f2(cy0)})`,
          },
          band,
        ),
      ]
    : band
  for (const [i, cx] of [l, r].entries()) {
    // open at 1, a hairline when shut
    const open = 1 - lids[i]!
    const gy = Math.max(1.2, gr * 1.25 * open)
    const at = {
      cx: f2(cx + gx * GLOW_TRAVEL),
      cy: f2(i === 0 ? ey : eyR),
    }
    parts.push(
      el('ellipse', key(`halo${i}`), {
        ...at,
        rx: f2(gr * 1.8),
        ry: f2(Math.max(2.4, gr * 2 * open)),
        fill: CYAN,
        opacity: 0.22,
      }),
      el('ellipse', key(`glow${i}`), {
        ...at,
        rx: f2(gr),
        ry: f2(gy),
        fill: CYAN,
      }),
    )
  }
  return group('visor', parts)
}

/** An ink patch over the left eye, its strap running off to the edges. */
const patch: WearDraw = (ctx) => {
  const { l: cx, ey, rx, ry } = sockets(ctx)
  const key = (p: string) => `wear.eyewear.patch.${p}`
  const prx = rx + 8
  const pry = ry + 8
  const ink = inkOf(ctx)
  // one strap end runs out to the side, the other up across the brow
  const a = toEdge(ctx, cx - prx * 0.9, ey - pry * 0.3, -1, -0.12)
  const bx = cx + prx * 0.55
  const by = ey - pry * 0.8
  const b = toEdge(ctx, bx, by, 1, -0.5)
  return group('patch', [
    el('path', key('strap'), {
      ...line(ctx, 4),
      d: `M${f2(cx - prx * 0.9)} ${f2(ey - pry * 0.3)}L${f2(a.x)} ${f2(a.y)}M${f2(bx)} ${f2(by)}L${f2(b.x)} ${f2(b.y)}`,
    }),
    el('ellipse', key('eye'), {
      cx: f2(cx),
      cy: f2(ey),
      rx: f2(prx),
      ry: f2(pry),
      fill: ink,
      stroke: ink,
      'stroke-width': f2(lineW(ctx, 3)),
    }),
    el('path', key('stitch'), {
      ...line(ctx, 2, INK.paper),
      opacity: 0.3,
      'stroke-dasharray': `${f2(lineW(ctx, 3))} ${f2(lineW(ctx, 4))}`,
      d: `M${f2(cx - prx * 0.62)} ${f2(ey - pry * 0.45)}Q${f2(cx)} ${f2(ey - pry * 0.85)} ${f2(cx + prx * 0.62)} ${f2(ey - pry * 0.45)}`,
    }),
  ])
}

/** Upswept lenses, tinted rose, in an ink frame. */
const cateye: WearDraw = (ctx) => {
  const { l, r, ey, rx, ry } = sockets(ctx)
  const key = (p: string) => `wear.eyewear.cateye.${p}`
  const a = Math.min(rx + 9, (r - l - 15) / 2)
  const b = ry + 7
  // the lens, right-hand; `s` mirrors it so the tip sweeps up and out
  const lens = (cx: number, s: number) => {
    const X = (u: number) => f2(cx + s * u * a)
    const Y = (v: number) => f2(ey + v * b)
    return `M${X(-1)} ${Y(-0.5)}C${X(-0.3)} ${Y(-1)} ${X(0.6)} ${Y(-0.92)} ${X(1.24)} ${Y(-1.18)}C${X(1.08)} ${Y(0.1)} ${X(0.78)} ${Y(1)} ${X(0)} ${Y(1)}C${X(-0.72)} ${Y(1)} ${X(-1.04)} ${Y(0.36)} ${X(-1)} ${Y(-0.5)}Z`
  }
  const parts: Node[] = [
    el('path', key('bridge'), {
      ...line(ctx, 5.25),
      d: `M${f2(l + a)} ${f2(ey - b * 0.5)}Q${f2((l + r) / 2)} ${f2(ey - b * 0.85)} ${f2(r - a)} ${f2(ey - b * 0.5)}`,
    }),
  ]
  for (const [i, cx] of [l, r].entries()) {
    const s = i === 0 ? -1 : 1
    const d = lens(cx, s)
    parts.push(
      el('path', key(`lens${i}.tint`), { d, fill: ROSE, opacity: 0.22 }),
      el('path', key(`lens${i}`), { ...line(ctx, 5.25), d }),
      el('path', key(`lens${i}.glint`), {
        ...line(ctx, 3, INK.paper),
        d: `M${f2(cx - s * a * 0.55)} ${f2(ey - b * 0.35)}Q${f2(cx - s * a * 0.4)} ${f2(ey - b * 0.66)} ${f2(cx - s * a * 0.08)} ${f2(ey - b * 0.74)}`,
      }),
    )
  }
  return group('cateye', parts)
}

export const EYEWEAR: Record<
  'monocle' | 'visor' | 'patch' | 'cateye',
  Wearable
> = {
  monocle: { draw: monocle },
  visor: { draw: visor },
  patch: { draw: patch },
  cateye: { draw: cateye },
}
