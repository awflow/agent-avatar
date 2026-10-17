import type { Node } from '../draw'

/*
 * A small bounding box for the drawings: absolute path commands (control
 * points included, so it errs wide), circles, ellipses and rects, through
 * translate / scale / rotate transforms.
 */
type M = [number, number, number, number, number, number]
export const mul = (a: M, b: M): M => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
]
const ID: M = [1, 0, 0, 1, 0, 0]
export function parseT(t = ''): M {
  let m = ID
  for (const [, op, args] of t.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const v = args!
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
    if (op === 'translate') m = mul(m, [1, 0, 0, 1, v[0]!, v[1] ?? 0])
    else if (op === 'scale') m = mul(m, [v[0]!, 0, 0, v[1] ?? v[0]!, 0, 0])
    else if (op === 'rotate') {
      const r = (v[0]! * Math.PI) / 180
      const [cx, cy] = [v[1] ?? 0, v[2] ?? 0]
      m = mul(m, [1, 0, 0, 1, cx, cy])
      m = mul(m, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0])
      m = mul(m, [1, 0, 0, 1, -cx, -cy])
    }
  }
  return m
}
function points(n: Node): [number, number][] {
  const a = n.attrs
  const num = (k: string) => Number(a[k] ?? 0)
  if (n.tag === 'circle' || n.tag === 'ellipse') {
    const rx = n.tag === 'circle' ? num('r') : num('rx')
    const ry = n.tag === 'circle' ? num('r') : num('ry')
    return [
      [num('cx') - rx, num('cy') - ry],
      [num('cx') + rx, num('cy') + ry],
    ]
  }
  if (n.tag === 'rect')
    return [
      [num('x'), num('y')],
      [num('x') + num('width'), num('y') + num('height')],
    ]
  if (n.tag !== 'path') return []
  return pathPoints(a.d!)
}
/*
 * Every point a path visits, control points included, in absolute units.
 * Absolute and relative commands; an arc adds its end point grown by its
 * radii, so a box of the points holds the arc.
 */
function pathPoints(d: string): [number, number][] {
  const out: [number, number][] = []
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  const arity: Record<string, number> = {
    M: 2,
    L: 2,
    T: 2,
    H: 1,
    V: 1,
    C: 6,
    S: 4,
    Q: 4,
    A: 7,
    Z: 0,
  }
  for (const [, cmd, args] of d.matchAll(
    /([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g,
  )) {
    const c = cmd!
    const C = c.toUpperCase()
    const rel = c !== C
    const v = (args!.match(/-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? []).map(
      Number,
    )
    const k = arity[C]!
    if (k === 0) {
      cx = sx
      cy = sy
      continue
    }
    for (let i = 0; i + k <= v.length; i += k) {
      const ox = rel ? cx : 0
      const oy = rel ? cy : 0
      if (C === 'H') {
        cx = v[i]! + ox
      } else if (C === 'V') {
        cy = v[i]! + oy
      } else if (C === 'A') {
        const ex = v[i + 5]! + ox
        const ey = v[i + 6]! + oy
        // the whole ellipse the arc lies on (unrotated arcs only), from
        // the SVG endpoint-to-centre conversion
        let rx = Math.abs(v[i]!)
        let ry = Math.abs(v[i + 1]!)
        const x1 = (cx - ex) / 2
        const y1 = (cy - ey) / 2
        const lam = (x1 * x1) / (rx * rx || 1) + (y1 * y1) / (ry * ry || 1)
        if (lam > 1) {
          rx *= Math.sqrt(lam)
          ry *= Math.sqrt(lam)
        }
        const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
        const den = rx * rx * y1 * y1 + ry * ry * x1 * x1 || 1
        const sign = v[i + 3] === v[i + 4] ? -1 : 1
        const f = sign * Math.sqrt(Math.max(0, num / den))
        const ccx = (f * rx * y1) / (ry || 1) + (cx + ex) / 2
        const ccy = (-f * ry * x1) / (rx || 1) + (cy + ey) / 2
        out.push([ccx - rx, ccy - ry], [ccx + rx, ccy + ry])
        cx = ex
        cy = ey
      } else {
        for (let j = 0; j + 1 < k; j += 2)
          out.push([v[i + j]! + ox, v[i + j + 1]! + oy])
        cx = v[i + k - 2]! + ox
        cy = v[i + k - 1]! + oy
      }
      out.push([cx, cy])
      if (C === 'M' && i === 0) {
        sx = cx
        sy = cy
      }
    }
  }
  return out
}
export function bounds(
  n: Node,
  m: M = ID,
  acc: number[] = [1e9, 1e9, -1e9, -1e9],
) {
  const mm = mul(m, parseT(n.attrs.transform))
  for (const [x, y] of points(n)) {
    const X = mm[0] * x + mm[2] * y + mm[4]
    const Y = mm[1] * x + mm[3] * y + mm[5]
    acc[0] = Math.min(acc[0]!, X)
    acc[1] = Math.min(acc[1]!, Y)
    acc[2] = Math.max(acc[2]!, X)
    acc[3] = Math.max(acc[3]!, Y)
  }
  for (const c of n.children) bounds(c, mm, acc)
  return acc
}
