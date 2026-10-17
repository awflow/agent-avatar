/*
 * Crown geometry shared by the drawing and the wardrobe: where a point sits
 * on the crown outline, and how deep a point is inside it.
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
