import { afterEach, describe, expect, test } from 'bun:test'
import { draw, frameOf, type Node } from './draw'
import { LISTS } from './identity'
import { el } from './node'
import {
  defineAccessory,
  registerPlugins,
  resetPluginsForTests,
} from './plugins'
import { settle, toSvg } from './svg'
import { FACES } from './tables'

const keys = (node: Node, out: string[] = []) => {
  out.push(node.key)
  for (const c of node.children) keys(c, out)
  return out
}
const find = (node: Node, key: string): Node | undefined => {
  if (node.key === key) return node
  for (const c of node.children) {
    const hit = find(c, key)
    if (hit) return hit
  }
}
const treeOf = (
  name: string,
  o: Parameters<typeof settle>[1],
  live = false,
) => {
  const { who, pose, opts } = settle(name, o, live)
  return draw(who, pose, opts)
}
const has = (tree: string[], prefix: string) =>
  tree.some((k) => k === prefix || k.startsWith(prefix))

// every part present (a live tree keeps the blush at 0), so a missing key
// means LOD dropped it
const full = {
  brows: 'arch',
  mouth: 'poly',
  cheeks: 'oval',
  trait: 'square',
  motif: 'dots',
  theme: 'bold',
  headwear: 'cap',
} as const

afterEach(() => resetPluginsForTests())

describe('level of detail', () => {
  test('lod tiers', () => {
    const t16 = keys(treeOf('Linh', { ...full, size: 16 }, true))
    for (const k of ['brow', 'mouth', 'cheek', 'trait', 'motif', 'headwear'])
      expect(has(t16, k)).toBe(false)
    expect(has(t16, 'body')).toBe(true)
    expect(has(t16, 'eye0')).toBe(true)

    const t32 = keys(treeOf('Linh', { ...full, size: 32 }, true))
    expect(has(t32, 'mouth')).toBe(true)
    expect(has(t32, 'motif')).toBe(true)
    expect(has(t32, 'headwear')).toBe(true)
    for (const k of ['brow', 'cheek', 'trait']) expect(has(t32, k)).toBe(false)

    const t96 = keys(treeOf('Linh', { ...full, size: 96 }, true))
    for (const k of ['brow', 'mouth', 'cheek', 'trait', 'motif', 'headwear'])
      expect(has(t96, k)).toBe(true)
  })

  test('tier 0 does no wardrobe work, and keeps the eyes under a visor', () => {
    let calls = 0
    registerPlugins([
      defineAccessory({
        slot: 'neckwear',
        name: 'counted',
        draw: () => {
          calls++
          return [el('circle', 'c', { cx: 170, cy: 300, r: 4 })]
        },
      }),
    ])
    treeOf('Linh', { ...full, neckwear: 'counted', size: 16 }, true)
    expect(calls).toBe(0)
    treeOf('Linh', { ...full, neckwear: 'counted', size: 32 }, true)
    expect(calls).toBe(1)
    // the visor replaces the eyes only where it is drawn
    const t16 = keys(treeOf('Linh', { eyewear: 'visor', size: 16 }, true))
    expect(has(t16, 'eye0')).toBe(true)
    expect(has(t16, 'eyewear')).toBe(false)
    const t32 = keys(treeOf('Linh', { eyewear: 'visor', size: 32 }, true))
    expect(has(t32, 'eye0')).toBe(false)
  })

  test('v1 keeps every part unless lod is asked for', () => {
    const v1 = { brows: 'arch', cheeks: 'oval', trait: 'square' } as const
    const t = keys(treeOf('Linh', { ...v1, version: 1, size: 16 }, true))
    for (const k of ['brow', 'mouth', 'cheek', 'trait'])
      expect(has(t, k)).toBe(true)
    const on = keys(treeOf('Linh', { ...v1, version: 1, size: 16, lod: true }))
    expect(has(on, 'brow')).toBe(false)
    // and v2 can opt out
    const off = keys(treeOf('Linh', { ...full, size: 16, lod: false }))
    expect(has(off, 'brow')).toBe(true)
  })

  test('the live tree keeps its nodes across expressions', () => {
    const shape = (expression: 'normal' | 'happy' | 'angry') =>
      keys(treeOf('Linh', { ...full, size: 32, expression }, true)).join()
    expect(shape('happy')).toBe(shape('normal'))
    expect(shape('angry')).toBe(shape('normal'))
  })

  test('tiny sizes stay finite', () => {
    for (const size of [12, 0, 1])
      expect(toSvg('Linh', { size })).not.toMatch(/NaN|Infinity|undefined/)
  })
})

describe('ring', () => {
  test('a ring in its colour', () => {
    const svg = toSvg('Linh', { ring: { color: '#F08A24', progress: 0.62 } })
    expect(svg).toMatch(/<circle[^>]*stroke="#F08A24"/)
    const ring = find(
      treeOf('Linh', { ring: { color: '#F08A24', progress: 0.62 } }),
      'ring',
    )
    expect(ring?.attrs.r).toBe('190')
    expect(ring?.attrs['stroke-width']).toBe('12')
    for (const progress of [0, 1, -1, 2, 0.5])
      expect(
        toSvg('Linh', { ring: { color: '#F08A24', progress } }),
      ).not.toMatch(/NaN|Infinity|undefined/)
    expect(keys(treeOf('Linh', {})).includes('ring')).toBe(false)
  })

  test('default options keep the id', () => {
    for (const version of [1, 2]) {
      const a = settle('Linh', { version }).opts.id
      expect(
        settle('Linh', { version, framing: 'peek', ring: null }).opts.id,
      ).toBe(a)
      expect(settle('Linh', { version, framing: 'full' }).opts.id).not.toBe(a)
      // the ring is state: it never moves the id
      expect(
        settle('Linh', { version, ring: { color: '#F08A24' } }).opts.id,
      ).toBe(a)
    }
  })
})

describe('full framing', () => {
  test('the whole body and its hat room sit inside the frame', () => {
    for (const shape of LISTS.face) {
      const tree = treeOf('Linh', { shape, framing: 'full' })
      const g = find(tree, 'framing')
      const m = g?.attrs.transform?.match(
        /^translate\(170 170\) scale\(0\.8\) translate\(-170 (-?[\d.]+)\)$/,
      )
      expect(m).toBeTruthy()
      const ty = Number(m![1])
      const sh = FACES[shape]
      const { baseY } = frameOf(sh)
      const top = Math.min(...sh.crown.poly.map(([, y]) => y)) - sh.crown.r
      const map = (y: number) => 170 + 0.8 * (y + baseY + ty)
      const a = map(top - 48)
      const b = map(sh.bottom)
      expect(a).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThanOrEqual(340)
      expect(Math.abs((a + b) / 2 - 170)).toBeLessThan(0.01)
    }
  })

  test('frame none + full spills over', () => {
    const svg = toSvg('Linh', { framing: 'full', frame: 'none', id: 'z' })
    expect(svg).toMatch(/^<svg[^>]*overflow="visible"/)
    expect(svg).not.toContain('url(#z-f)')
    expect(svg).not.toContain('id="z-f"')
    expect(toSvg('Linh', { framing: 'full', id: 'z' })).not.toContain(
      'overflow',
    )
    expect(toSvg('Linh', { frame: 'none', id: 'z' })).not.toContain('overflow')
  })

  test('clay casts a contact shadow only in full', () => {
    const k = (o: Parameters<typeof settle>[1]) =>
      keys(treeOf('Linh', { theme: 'clay', ...o }))
    expect(k({ framing: 'full' }).includes('shade.contact')).toBe(true)
    expect(k({}).includes('shade.contact')).toBe(false)
    expect(
      keys(treeOf('Linh', { theme: 'bold', framing: 'full' })).includes(
        'shade.contact',
      ),
    ).toBe(false)
  })
})
