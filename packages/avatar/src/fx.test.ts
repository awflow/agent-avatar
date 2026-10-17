import { describe, expect, test } from 'bun:test'
import { ACTIVITIES, type Activity } from './activity'
import { draw, type Node, REST_T } from './draw'
import { FX_KINDS, FX_POOL, fxShapes } from './fx'
import { type AvatarOptions, settle, toSvg } from './svg'

const ACTS = Object.keys(ACTIVITIES) as Activity[]
const ANCHOR = { headX: 170, headTop: 100, side: 140, eyeY: 235, mouthY: 300 }

const keys = (node: Node, out: string[] = []) => {
  out.push(node.key)
  for (const c of node.children) keys(c, out)
  return out
}
const find = (node: Node, key: string): Node | undefined => {
  if (node.key === key) return node
  for (const c of node.children) {
    const f = find(c, key)
    if (f) return f
  }
}
const treeOf = (name: string, o: AvatarOptions, live = false) => {
  const { who, pose, opts } = settle(name, o, live)
  return draw(who, pose, opts)
}
const fxKeys = (tree: Node) => keys(tree).filter((k) => /^fx\.\d+$/.test(k))
const paths = (svg: string) => svg.split('<path').length - 1

describe('fxShapes', () => {
  test('at most 24 finite shapes for every kind', () => {
    for (const kind of FX_KINDS)
      for (const t of [0, 0.9, 7.3])
        for (const p of [0, 0.5, 1])
          for (const onDark of [false, true]) {
            const s = fxShapes(kind, t, p, ANCHOR, '#1A1918', onDark)
            expect(s.length).toBeGreaterThan(0)
            expect(s.length).toBeLessThanOrEqual(FX_POOL)
            for (const x of s) {
              expect(Number.isFinite(x.opacity)).toBe(true)
              expect(Number.isFinite(x.strokeWidth)).toBe(true)
              expect(`${x.d}${x.transform}`).not.toMatch(
                /NaN|Infinity|undefined/,
              )
            }
          }
  })

  test('deterministic', () => {
    for (const kind of FX_KINDS)
      expect(fxShapes(kind, 3.3, 0.4, ANCHOR, '#000', false)).toEqual(
        fxShapes(kind, 3.3, 0.4, ANCHOR, '#000', false),
      )
  })
})

describe('the fx pool', () => {
  test('pool is stable: sized by the LOD tier, the same for every pose', () => {
    const pool = (n: number) => Array.from({ length: n }, (_, i) => `fx.${i}`)
    // below 44px only the ask badge draws: 3 nodes hold it
    const want: Record<number, string[]> = {
      16: pool(3),
      32: pool(3),
      96: pool(24),
    }
    for (const size of [16, 32, 96])
      for (const framing of ['peek', 'full'] as const) {
        let first: string[] | null = null
        for (const activity of ACTS) {
          const { who, pose, opts } = settle(
            'Linh',
            { activity, framing, size },
            true,
          )
          for (const t of [0, REST_T, 5.5])
            for (const fx of [null, 'confetti', 'hearts'] as const) {
              const all = keys(draw(who, { ...pose, t, fx, fxP: 0.4 }, opts))
              expect(all.filter((k) => /^fx\.\d+$/.test(k))).toEqual(
                want[size]!,
              )
              first ??= all
              expect(all).toEqual(first)
            }
        }
      }
    // lod off draws every fx at any size: the full pool
    const { who, pose, opts } = settle('Linh', { size: 16, lod: false }, true)
    expect(fxKeys(draw(who, pose, opts))).toEqual(pool(24))
  })

  test('the ask badge fits the small pool', () => {
    for (const size of [16, 32]) {
      const tree = treeOf('Linh', { activity: 'waiting', size }, true)
      const shown = fxKeys(tree).filter(
        (k) => find(tree, k)!.attrs.opacity !== '0',
      )
      expect(shown).toEqual(['fx.0', 'fx.1', 'fx.2'])
    }
  })

  test('a static idle tree has no fx nodes', () => {
    expect(fxKeys(treeOf('Linh', {}))).toEqual([])
    expect(fxKeys(treeOf('Linh', { activity: 'idle' }))).toEqual([])
  })

  test('static phase: thinking draws 3 bubbles, fx false none', () => {
    const tree = treeOf('Linh', { activity: 'thinking' })
    expect(fxKeys(tree)).toEqual(['fx.0', 'fx.1', 'fx.2'])
    const on = toSvg('Linh', { activity: 'thinking' })
    const off = toSvg('Linh', { activity: 'thinking', fx: false })
    expect(paths(on) - paths(off)).toBe(3)
    expect(fxKeys(treeOf('Linh', { activity: 'thinking', fx: false }))).toEqual(
      [],
    )
  })

  test('every activity with fx draws some at the static phase', () => {
    for (const activity of ACTS) {
      const n = fxKeys(treeOf('Linh', { activity })).length
      if (ACTIVITIES[activity].fx.length) expect(n).toBeGreaterThan(0)
      else expect(n).toBe(0)
    }
  })

  test('a string fx draws that kind too', () => {
    const n = fxKeys(treeOf('Linh', { activity: 'thinking', fx: 'sweat' }))
    expect(n.length).toBeGreaterThan(3)
  })

  test('LOD: no fx below 44px except ask', () => {
    const at = (activity: Activity, size: number) =>
      fxKeys(treeOf('Linh', { activity, size, version: 2 })).length
    expect(at('thinking', 32)).toBe(0)
    expect(at('thinking', 64)).toBe(3)
    expect(at('waiting', 32)).toBeGreaterThan(0)
  })

  test('full framing draws fx inside the framing transform', () => {
    const tree = treeOf('Linh', { activity: 'thinking', framing: 'full' })
    const framing = find(tree, 'framing')!
    expect(find(framing, 'fx.0')).toBeTruthy()
  })

  test('fx at its default keeps the id; off it does not', () => {
    const a = settle('Linh', {}).opts.id
    expect(settle('Linh', { fx: true }).opts.id).toBe(a)
    expect(settle('Linh', { fx: false }).opts.id).not.toBe(a)
  })
})

describe('the ring is state', () => {
  test('always emitted in a live tree, invisible without a ring', () => {
    const ring = find(treeOf('Linh', {}, true), 'ring')
    expect(ring?.attrs.opacity).toBe('0')
    const on = find(
      treeOf('Linh', { ring: { color: '#F08A24' } }, true),
      'ring',
    )
    expect(on?.attrs.stroke).toBe('#F08A24')
    expect(on?.attrs.opacity).not.toBe('0')
  })

  test('the ring stays out of the id', () => {
    const a = settle('Linh', {}).opts.id
    expect(settle('Linh', { ring: { color: '#F08A24' } }).opts.id).toBe(a)
  })

  test('a pulsing ring breathes in a live tree, solid when static', () => {
    const { who, pose, opts } = settle(
      'Linh',
      { ring: { color: '#F08A24', pulse: true } },
      true,
    )
    const op = (t: number) =>
      Number(find(draw(who, { ...pose, t }, opts), 'ring')!.attrs.opacity)
    // the static phase is the peak, so the first live frame is solid
    expect(op(REST_T)).toBeCloseTo(1, 3)
    expect(op(REST_T + Math.PI / 10)).toBeCloseTo(0.55, 3)
    expect(op(REST_T + Math.PI / 5)).toBeCloseTo(0.1, 3)
    const still = find(
      treeOf('Linh', { ring: { color: '#F08A24', pulse: true } }),
      'ring',
    )
    expect(still?.attrs.opacity).toBeUndefined()
  })
})
