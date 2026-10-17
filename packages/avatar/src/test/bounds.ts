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
  const out: [number, number][] = []
  for (const [, c, args] of a.d!.matchAll(/([MLCQZHV])([^MLCQZHV]*)/g)) {
    const v = args!
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
    if (c === 'H' || c === 'V') continue
    for (let i = 0; i + 1 < v.length; i += 2) out.push([v[i]!, v[i + 1]!])
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
