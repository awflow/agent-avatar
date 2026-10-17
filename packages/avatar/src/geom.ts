/*
 * Geometry shared by the drawing and the wardrobe: where a point sits on the
 * crown outline, how deep a point is inside it, and how wide the body is at
 * a given height.
 */

import type { FaceGeom } from './tables'

export const RAD = Math.PI / 180

export const clamp = (v: number, a: number, b: number) =>
  v < a ? a : v > b ? b : v
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
/**
 * A point on the crown outline grown by `d`, reached by walking `u` along it
 * from the top (where the outward normal points straight up); u > 0 walks
 * right. Returns the point and the normal's bearing in degrees.
 */
export function seat(
  crown: FaceGeom['crown'],
  d: number,
  u: number,
): { x: number; y: number; a: number } {
  const R = Math.max(0, crown.r + d)
  const at = ([x, y]: readonly [number, number], b: number) => ({
    x: x + R * Math.sin(b),
    y: y - R * Math.cos(b),
    a: b / RAD,
  })
  const P = crown.poly
  if (P.length === 1) return at(P[0]!, R ? u / R : 0)
  const n = P.length
  const dir = u >= 0 ? 1 : -1
  let left = Math.abs(u)
  let i = 0
  let b = 0
  for (let step = 0; step < n; step++) {
    const j = (i + dir + n) % n
    const [x0, y0] = P[i]!
    const [x1, y1] = P[j]!
    const ex = x1 - x0
    const ey = y1 - y0
    const L = Math.hypot(ex, ey)
    const nx = (dir * ey) / L
    const ny = (-dir * ex) / L
    const be = Math.atan2(nx, -ny)
    let db = be - b
    while (dir * db < 0) db += dir * 2 * Math.PI
    const arc = R * Math.abs(db)
    if (left <= arc) return at(P[i]!, R ? b + (dir * left) / R : b)
    left -= arc
    if (left <= L)
      return {
        x: x0 + (ex / L) * left + R * nx,
        y: y0 + (ey / L) * left + R * ny,
        a: be / RAD,
      }
    left -= L
    i = j
    b = be
  }
  return at(P[i]!, b)
}

/** Signed distance from a point to the crown outline, negative inside. */
export function depth(crown: FaceGeom['crown'], x: number, y: number) {
  const P = crown.poly
  if (P.length === 1) return Math.hypot(x - P[0]![0], y - P[0]![1]) - crown.r
  let out = -Infinity
  let near = Infinity
  for (let i = 0; i < P.length; i++) {
    const [ax, ay] = P[i]!
    const [bx, by] = P[(i + 1) % P.length]!
    const ex = bx - ax
    const ey = by - ay
    const L2 = ex * ex + ey * ey
    const L = Math.sqrt(L2)
    out = Math.max(out, ((x - ax) * ey - (y - ay) * ex) / L)
    const t = clamp(((x - ax) * ex + (y - ay) * ey) / L2, 0, 1)
    near = Math.min(near, Math.hypot(x - ax - t * ex, y - ay - t * ey))
  }
  return (out <= 0 ? out : near) - crown.r
}

type Pt2 = [number, number]

/** An SVG path flattened to points (arcs and curves sampled). */
function flatten(d: string): Pt2[] {
  const tok = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? []
  const out: Pt2[] = []
  let i = 0
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let cmd = ''
  const num = () => Number(tok[i++])
  const isNum = () => i < tok.length && !/[a-zA-Z]/.test(tok[i]!)
  while (i < tok.length) {
    if (!isNum()) cmd = tok[i++]!
    const rel = cmd === cmd.toLowerCase()
    const ox = rel ? x : 0
    const oy = rel ? y : 0
    switch (cmd.toUpperCase()) {
      case 'M':
        x = ox + num()
        y = oy + num()
        sx = x
        sy = y
        out.push([x, y])
        cmd = rel ? 'l' : 'L'
        break
      case 'L':
        x = ox + num()
        y = oy + num()
        out.push([x, y])
        break
      case 'H':
        x = ox + num()
        out.push([x, y])
        break
      case 'V':
        y = oy + num()
        out.push([x, y])
        break
      case 'Q':
      case 'C': {
        const n = cmd.toUpperCase() === 'Q' ? 2 : 3
        const P: Pt2[] = [[x, y]]
        for (let k = 0; k < n; k++) P.push([ox + num(), oy + num()])
        for (let s = 1; s <= 16; s++) {
          const t = s / 16
          let Q = P.map((p) => [...p] as Pt2)
          while (Q.length > 1)
            Q = Q.slice(1).map((p, j) => [
              Q[j]![0] + (p[0] - Q[j]![0]) * t,
              Q[j]![1] + (p[1] - Q[j]![1]) * t,
            ])
          out.push(Q[0]!)
        }
        ;[x, y] = P[n]!
        break
      }
      case 'A': {
        let rx = Math.abs(num())
        let ry = Math.abs(num())
        const phi = num() * RAD
        const large = num() !== 0
        const sweep = num() !== 0
        const x2 = ox + num()
        const y2 = oy + num()
        const c = Math.cos(phi)
        const s = Math.sin(phi)
        const dx = (x - x2) / 2
        const dy = (y - y2) / 2
        const x1p = c * dx + s * dy
        const y1p = -s * dx + c * dy
        const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
        if (lam > 1) {
          rx *= Math.sqrt(lam)
          ry *= Math.sqrt(lam)
        }
        const num2 =
          rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
        const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
        const k =
          (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num2 / den))
        const cxp = (k * rx * y1p) / ry
        const cyp = (-k * ry * x1p) / rx
        const cx = c * cxp - s * cyp + (x + x2) / 2
        const cy = s * cxp + c * cyp + (y + y2) / 2
        const ang = (ux: number, uy: number, vx: number, vy: number) =>
          Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
        const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
        let dt = ang(
          (x1p - cxp) / rx,
          (y1p - cyp) / ry,
          (-x1p - cxp) / rx,
          (-y1p - cyp) / ry,
        )
        if (!sweep && dt > 0) dt -= 2 * Math.PI
        if (sweep && dt < 0) dt += 2 * Math.PI
        for (let j = 1; j <= 24; j++) {
          const t = t1 + (dt * j) / 24
          const ex = rx * Math.cos(t)
          const ey = ry * Math.sin(t)
          out.push([c * ex - s * ey + cx, s * ex + c * ey + cy])
        }
        x = x2
        y = y2
        break
      }
      case 'Z':
        x = sx
        y = sy
        out.push([x, y])
        break
      default:
        // an unknown command: give up on the rest, keep what we have
        return out
    }
  }
  return out
}

const OUTLINES = new WeakMap<object, Pt2[]>()

/**
 * The body's half-width at height `y`, measured from the centre line (x 170)
 * to the nearer edge, the rounded rim included. 0 when y misses the body.
 */
export function halfWidthAt(face: FaceGeom, y: number): number {
  const b = face.body
  if ('circle' in b) {
    const [, cy, r] = b.circle
    const h = r * r - (y - cy) ** 2
    return h > 0 ? Math.sqrt(h) : 0
  }
  let P = OUTLINES.get(b)
  if (!P) {
    P = flatten(b.d)
    OUTLINES.set(b, P)
  }
  let left = -Infinity
  let right = Infinity
  for (let i = 0; i + 1 < P.length; i++) {
    const [ax, ay] = P[i]!
    const [bx, by] = P[i + 1]!
    if (ay === by || (y - ay) * (y - by) > 0) continue
    const x = ax + ((y - ay) / (by - ay)) * (bx - ax)
    if (x <= 170) left = Math.max(left, x)
    else right = Math.min(right, x)
  }
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 0
  return Math.min(170 - left, right - 170) + (b.stroke ?? 0) / 2
}
