import { describe, expect, test } from 'bun:test'
import { draw, type Node } from './draw'
import { LISTS } from './identity'
import { settle, toSvg } from './svg'

const keys = (node: Node, out: string[] = []) => {
  out.push(node.key)
  for (const c of node.children) keys(c, out)
  return out
}
const treeOf = (
  name: string,
  o: Parameters<typeof settle>[1],
  live = false,
) => {
  const { who, pose, opts } = settle(name, o, live)
  return draw(who, pose, opts)
}
const names = Array.from({ length: 200 }, (_, i) => `motif person ${i}`)

describe('motifs', () => {
  test('motifs draw clipped', () => {
    for (const motif of LISTS.motif) {
      const svg = toSvg('Linh', { theme: 'bold', motif })
      expect(svg).not.toMatch(/NaN|Infinity|undefined/)
      // plain draws no motif (bold's shading still uses the clip)
      const tree = keys(treeOf('Linh', { theme: 'bold', motif }))
      expect(tree.includes('motif')).toBe(motif !== 'plain')
      if (motif !== 'plain') {
        expect(svg).toMatch(/clip-path="url\(#[^"]*-b\)"/)
        expect(svg).toMatch(/<clipPath id="[^"]*-b">/)
      }
    }
  })

  test('every motif on every shape is clean', () => {
    for (const shape of LISTS.face)
      for (const motif of LISTS.motif)
        for (const theme of ['bold', 'mono', 'neon', 'clay'])
          expect(toSvg('Linh', { theme, motif, shape })).not.toMatch(
            /NaN|Infinity|undefined/,
          )
  })

  test('soft hides hashed motifs', () => {
    for (const n of names) {
      expect(settle(n, { theme: 'soft' }).who.motif).toBe('plain')
      expect(settle(n, { theme: 'soft', motif: 'dots' }).who.motif).toBe('dots')
    }
  })

  test('speckle is seeded by the name', () => {
    const a = toSvg('Linh', {
      theme: 'bold',
      motif: 'speckle',
      id: 'x',
      title: false,
    })
    expect(
      toSvg('Linh', { theme: 'bold', motif: 'speckle', id: 'x', title: false }),
    ).toBe(a)
    expect(
      toSvg(' linh ', {
        theme: 'bold',
        motif: 'speckle',
        id: 'x',
        title: false,
      }),
    ).toBe(a)
    expect(
      toSvg('Ada', {
        theme: 'bold',
        motif: 'speckle',
        id: 'x',
        title: false,
        shape: settle('Linh', {}).who.face,
        color: settle('Linh', { theme: 'bold' }).who.color,
      }),
    ).not.toBe(a)
  })

  test('shading per theme', () => {
    const has = (theme: string) =>
      keys(treeOf('Linh', { theme, motif: 'plain' }))
    const bold = has('bold')
    expect(bold).toContain('shade.bold')
    expect(bold).not.toContain('outline')
    const clay = has('clay')
    expect(clay.filter((k) => k.startsWith('shade.clay')).length).toBe(3)
    const mono = has('mono')
    expect(mono).toContain('outline')
    expect(mono).not.toContain('outline.glow')
    expect(mono.some((k) => k.startsWith('shade.'))).toBe(false)
    const neon = has('neon')
    expect(neon).toContain('outline')
    expect(neon).toContain('outline.glow')
    const soft = has('soft')
    expect(
      soft.some(
        (k) =>
          k.startsWith('shade') ||
          k.startsWith('outline') ||
          k.startsWith('motif') ||
          k === 'body.clip',
      ),
    ).toBe(false)
  })

  test('outline and glow follow the body transform', () => {
    const tree = treeOf('Linh', { theme: 'neon', motif: 'dots' })
    const find = (node: Node, key: string): Node[] => [
      ...(node.key === key ? [node] : []),
      ...node.children.flatMap((c) => find(c, key)),
    ]
    const av = find(tree, 'av')[0]!
    for (const k of ['outline', 'outline.glow', 'motif', 'body'])
      expect(find(av, k).length).toBe(1)
  })

  test('live tree keeps the same nodes across expressions', () => {
    const shape = (expression: 'normal' | 'happy' | 'sleepy' | 'angry') =>
      keys(
        treeOf(
          'Linh',
          { theme: 'clay', motif: 'waves', expression, id: 'x' },
          true,
        ),
      ).join()
    const base = shape('normal')
    for (const e of ['happy', 'sleepy', 'angry'] as const)
      expect(shape(e)).toBe(base)
  })
})
