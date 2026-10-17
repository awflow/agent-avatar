import { describe, expect, test } from 'bun:test'
import { Live } from '../animate'
import { draw, type Node, type Pose, restPose } from '../draw'
import { halfWidthAt } from '../geom'
import { serialize, settle, toSvg } from '../svg'
import { ACCESSORIES, EXPRESSIONS, type Expression, FACES } from '../tables'
import { bounds } from '../test/bounds'
import { fakeDom, motion } from '../test/dom'
import { springsOf, WEAR } from './context'
import { DECOR } from './decor'
import { bodyHalf, NECKWEAR } from './neckwear'

fakeDom()

const NECK = ['bowtie', 'scarf', 'necklace', 'badge'] as const
const FACE = ['freckles', 'mustache', 'bandaid', 'sticker'] as const
const SHAPES = Object.keys(FACES) as (keyof typeof FACES)[]
const EXPRS = Object.keys(EXPRESSIONS) as Expression[]

const flat = (n: Node): Node[] => [n, ...n.children.flatMap(flat)]
const keys = (n: Node) => flat(n).map((c) => c.key)
const find = (n: Node, key: string) => flat(n).find((c) => c.key === key)
/** The chain of nodes from the root down to `key`, the node itself last. */
function path(n: Node, key: string): Node[] | undefined {
  if (n.key === key) return [n]
  for (const c of n.children) {
    const p = path(c, key)
    if (p) return [n, ...p]
  }
  return undefined
}
/** Every clip on the way down to a node, by ancestor key. */
const clips = (tree: Node, key: string) =>
  path(tree, key)!
    .filter((a) => a.attrs['clip-path'])
    .map(
      (a) =>
        `${a.key}:${a.attrs['clip-path']!.replace(/#[a-z]+-[a-z0-9]+-/, '#')}`,
    )

function worn(o: Record<string, unknown>, live = false) {
  const { who, pose, opts } = settle('Ada', { size: 300, ...o }, live)
  return { who, pose, opts, tree: draw(who, pose, { ...opts, live }) }
}

describe('registries', () => {
  test('neckwear: four items, only the scarf swings', () => {
    expect(Object.keys(NECKWEAR).sort()).toEqual([...NECK].sort())
    for (const k of NECK) {
      expect((ACCESSORIES.neckwear as readonly string[]).includes(k)).toBe(true)
      expect(WEAR.neckwear[k]).toBe(NECKWEAR[k])
    }
    expect(NECKWEAR.scarf.physics).toEqual({
      stiffness: 9,
      damping: 0.2,
      maxSwing: 20,
    })
    for (const k of ['bowtie', 'necklace', 'badge'] as const)
      expect(NECKWEAR[k].physics).toBe(undefined)
    expect(WEAR.neckwear.tie).toBe(undefined)
    expect(springsOf({ neckwear: 'scarf' })).toEqual({
      neckwear: NECKWEAR.scarf.physics,
    })
  })

  test('decor: four items, no springs', () => {
    expect(Object.keys(DECOR).sort()).toEqual([...FACE].sort())
    for (const k of FACE) {
      expect((ACCESSORIES.decor as readonly string[]).includes(k)).toBe(true)
      expect(WEAR.decor[k]).toBe(DECOR[k])
      expect((DECOR[k] as { physics?: unknown }).physics).toBe(undefined)
    }
  })
})

describe('each item is clean', () => {
  const check = (slot: 'neckwear' | 'decor', name: string) => {
    for (const shape of SHAPES)
      for (const e of EXPRS) {
        const o = {
          shape,
          expression: e,
          ...(slot === 'neckwear' ? { neckwear: name } : { face: name }),
        } as any
        expect(toSvg('Ada', o)).not.toMatch(/NaN|Infinity|undefined|null/)
        const { tree } = worn(o)
        const node = find(tree, `wear.${slot}.${name}`)
        expect(node).toBeDefined()
        for (const c of flat(node!))
          expect(c.key.startsWith(`wear.${slot}.${name}`)).toBe(true)
        expect(flat(node!).length).toBeGreaterThan(2)
      }
  }
  for (const name of NECK)
    test(`neckwear ${name} × 15 shapes × 11 expressions`, () =>
      check('neckwear', name))
  for (const name of FACE)
    test(`decor ${name} × 15 shapes × 11 expressions`, () =>
      check('decor', name))
})

describe('neckwear', () => {
  test("carries the floor clip like Peek's tie", () => {
    for (const shape of ['circle', 'capsule', 'triangle'] as const) {
      const tie = worn({ shape, neckwear: 'tie' }).tree
      const ref = clips(tie, 'neckwear')
      expect(ref.length).toBeGreaterThan(0)
      expect(ref.some((c) => c.startsWith('frame:'))).toBe(true)
      for (const name of NECK) {
        const tree = worn({ shape, neckwear: name }).tree
        expect(clips(tree, `wear.neckwear.${name}`)).toEqual(ref)
        // inside the body group, so it moves, tilts and sinks with the body
        expect(
          path(tree, `wear.neckwear.${name}`)!.map((a) => a.key),
        ).toContain('av')
      }
    }
  })

  test('hangs from the neck line', () => {
    for (const shape of ['circle', 'cube', 'bean'] as const) {
      const { tree } = worn({ shape, neckwear: 'bowtie' })
      const node = find(tree, 'wear.neckwear.bowtie')!
      const m = /translate\(([\d.-]+) ([\d.-]+)\)/.exec(node.attrs.transform!)!
      expect(Number(m[1])).toBe(170)
      // the neck line, nudged by the persona's mouth offset at rest
      expect(Math.abs(Number(m[2]) - FACES[shape].neck)).toBeLessThan(6)
    }
  })

  test('mock colours', () => {
    const svg = (k: string) => toSvg('Ada', { neckwear: k as any })
    expect(svg('bowtie')).toContain('#E5412D')
    expect(svg('scarf')).toContain('#F0A54A')
    const stripes = find(
      worn({ neckwear: 'scarf' }).tree,
      'wear.neckwear.scarf.stripes',
    )!
    expect(stripes.attrs.stroke).toBe('#FFFFFF')
    const pearls = find(
      worn({ neckwear: 'necklace' }).tree,
      'wear.neckwear.necklace.pearls',
    )!
    expect(pearls.children.length).toBe(9)
    const neck = worn({ neckwear: 'necklace' }).tree
    expect(find(neck, 'wear.neckwear.necklace.thread')).toBeDefined()
    expect(find(neck, 'wear.neckwear.necklace.pendant')!.attrs.fill).toBe(
      '#E8B931',
    )
    // spaced beads, so the thread shows between them
    const cs = pearls.children.map((c) => Number(c.attrs.cx))
    const r = Number(pearls.children[0]!.attrs.r)
    for (let i = 1; i < cs.length; i++)
      expect(cs[i]! - cs[i - 1]!).toBeGreaterThan(2 * r + 2)
    const badge = worn({ neckwear: 'badge' }).tree
    expect(find(badge, 'wear.neckwear.badge.lanyard')!.attrs.stroke).toBe(
      '#3B82F6',
    )
    expect(find(badge, 'wear.neckwear.badge.card')!.attrs.fill).toBe('#FFFFFF')
    expect(find(badge, 'wear.neckwear.badge.lines')!.attrs.stroke).toBe(
      '#F08A24',
    )
  })

  test('the body half-width at a height matches the outlines', () => {
    const at = (f: keyof typeof FACES, y: number) => halfWidthAt(FACES[f], y)
    expect(at('circle', 170)).toBeCloseTo(150, 1)
    expect(at('circle', 290)).toBeCloseTo(90, 1)
    expect(at('diamond', 250)).toBeCloseTo(70, 1)
    expect(at('diamond', 100)).toBeCloseTo(80, 1)
    // the triangle's rounded rim adds half its stroke
    expect(at('triangle', 170)).toBeCloseTo((129.2 / 258.4) * 142.8 + 13.6, 1)
    expect(at('capsule', 170)).toBeCloseTo(95.2, 1)
    expect(at('cube', 170)).toBeCloseTo(149.6, 1)
    expect(at('bean', 170)).toBeCloseTo(163.2, 1)
    expect(at('semicircle', 170)).toBeCloseTo(Math.sqrt(170 ** 2 - 85 ** 2), 0)
    expect(at('semicircle', 260)).toBe(0)
    expect(at('circle', 330)).toBe(0)
  })

  test('the scarf band hugs the body on every shape', () => {
    for (const shape of SHAPES)
      for (const expression of ['normal', 'surprised', 'excited'] as const) {
        const node = find(
          worn({ shape, expression, neckwear: 'scarf' }).tree,
          'wear.neckwear.scarf',
        )!
        const y0 = Number(
          /translate\([\d.-]+ ([\d.-]+)\)/.exec(node.attrs.transform!)![1],
        )
        const band = find(node, 'wear.neckwear.scarf.band')!
        const pts = [...band.attrs.d!.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(
          (m) => [Number(m[1]), Number(m[2])] as const,
        )
        // the four ends: top left, top right, bottom right, bottom left
        for (const i of [0, 2, 3, 5]) {
          const [x, y] = pts[i]!
          // past a flat bottom the outline is the bottom edge
          const w = bodyHalf(FACES[shape], y0 + y)
          expect(w).toBeGreaterThan(0)
          if (halfWidthAt(FACES[shape], y0 + y) === 0)
            expect(y0 + y).toBeLessThan(FACES[shape].bottom + 12)
          expect(Math.abs(x)).toBeLessThanOrEqual(w + 6)
          // a visible collar, never a sliver
          expect(Math.abs(x)).toBeGreaterThanOrEqual(30)
        }
      }
  })

  test('the necklace keeps clear of the mouth in every expression', () => {
    let least = Infinity
    for (const shape of SHAPES)
      for (const expression of EXPRS)
        for (const mouth of ['poly', 'round', 'box', 'cat'] as const) {
          const { tree } = worn({
            shape,
            expression,
            mouth,
            neckwear: 'necklace',
          })
          const root = find(tree, 'wear.neckwear.necklace')!
          const pearls = find(root, 'wear.neckwear.necklace.pearls')!
          const beadTop = bounds({ ...root, children: [pearls] })[1]!
          const mouthBottom = bounds(find(tree, 'mouth')!)[3]!
          least = Math.min(least, beadTop - mouthBottom)
        }
    // the mouth's box counts curve control points, so it errs low
    expect(least).toBeGreaterThanOrEqual(15)
  })

  test('the scarf tail swings by the neckwear angle, else by wob', () => {
    const { who, pose, opts } = settle('Ada', { neckwear: 'scarf' })
    const at = (p: Partial<Pose>) =>
      find(draw(who, { ...pose, ...p }, opts), 'wear.neckwear.scarf.tail')!
        .attrs.transform
    expect(at({ wob: 12 })).toContain('rotate(12 ')
    expect(at({ wob: 12, swing: { neckwear: -7 } })).toContain('rotate(-7 ')
    expect(at({ wob: 12, swing: { headwear: 3 } })).toContain('rotate(12 ')
  })

  test('ink lines follow the theme ink', () => {
    for (const name of NECK) {
      const o = { neckwear: name, theme: 'neon' }
      const { who, opts } = settle('Ada', o)
      const ink = opts.theme!.ink(opts.ink ?? opts.theme!.colors[who.color])
      expect(toSvg('Ada', o)).toContain(`stroke="${ink}"`)
    }
  })
})

describe('decor', () => {
  test("settle('Linh', {face: 'freckles'}) renders the freckles", () => {
    const { who, pose, opts } = settle('Linh', { face: 'freckles' })
    const ks = keys(draw(who, pose, opts))
    const own = ks.filter((k) => k.startsWith('wear.decor.freckles.'))
    expect(own.length).toBeGreaterThanOrEqual(6)
    const tree = draw(who, pose, opts)
    const dots = flat(find(tree, 'wear.decor.freckles')!).filter(
      (c) => c.tag === 'circle',
    )
    expect(dots.length).toBe(6)
    const g0 = find(tree, 'wear.decor.freckles.cheek0')!
    expect(g0.attrs.fill).toBe('#8A5A3B')
    expect(g0.attrs.opacity).toBe('0.7')
  })

  test('cheek sides and colours', () => {
    const cx = (tree: Node, key: string) => {
      const m = /translate\(([\d.-]+) /.exec(find(tree, key)!.attrs.transform!)!
      return Number(m[1])
    }
    const band = worn({ face: 'bandaid' }).tree
    expect(cx(band, 'wear.decor.bandaid')).toBeGreaterThan(170)
    expect(find(band, 'wear.decor.bandaid.strip')!.attrs.fill).toBe('#E9C29B')
    const star = worn({ face: 'sticker' }).tree
    expect(cx(star, 'wear.decor.sticker')).toBeLessThan(170)
    expect(find(star, 'wear.decor.sticker.star')!.attrs.fill).toBe('#F2C14E')
    const { tree, who, opts } = worn({ face: 'mustache', theme: 'neon' })
    const ink = opts.theme!.ink(opts.ink ?? opts.theme!.colors[who.color])
    expect(find(tree, 'wear.decor.mustache.curl')!.attrs.fill).toBe(ink)
    // above the mouth
    const m = /translate\(([\d.-]+) ([\d.-]+)\)/.exec(
      find(tree, 'wear.decor.mustache')!.attrs.transform!,
    )!
    expect(Number(m[2])).toBeLessThan(FACES[who.face].mouth.y)
  })

  test('decor sits after the cheeks and before the eyewear', () => {
    for (const eyewear of ['glasses', 'monocle'] as const) {
      const { tree } = worn({ face: 'sticker', cheeks: 'dots', eyewear }, true)
      const all = keys(tree)
      const at = (k: string) => all.indexOf(k)
      const ew = eyewear === 'glasses' ? 'eyewear' : 'wear.eyewear.monocle'
      expect(at('cheek0')).toBeGreaterThanOrEqual(0)
      expect(at('wear.decor.sticker')).toBeGreaterThan(at('cheek1'))
      expect(at('wear.decor.sticker')).toBeGreaterThan(at('mouth'))
      expect(at(ew)).toBeGreaterThan(at('wear.decor.sticker'))
    }
  })

  test('decor joins with the wardrobe from tier 1', () => {
    const at = (size: number) =>
      keys(
        draw(
          ...(() => {
            const s = settle('Ada', { face: 'freckles', size, lod: true })
            return [s.who, s.pose, s.opts] as const
          })(),
        ),
      ).includes('wear.decor.freckles')
    expect(at(20)).toBe(false)
    expect(at(32)).toBe(true)
    expect(at(64)).toBe(true)
  })
})

describe('live', () => {
  test('the live tree holds its nodes across random poses', () => {
    const acts = ['idle', 'listening', 'working', 'thinking'] as const
    let seed = 11
    const rnd = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    const items = [
      ...NECK.map((k) => ({ neckwear: k })),
      ...FACE.map((k) => ({ face: k })),
    ]
    for (const item of items)
      for (const shape of ['circle', 'triangle', 'cube'] as const) {
        const { who, opts } = settle('Ada', { shape, ...item }, true)
        const o = { ...opts, live: true }
        const ref = keys(draw(who, restPose(who, 'normal'), o))
        for (let i = 0; i < 20; i++) {
          const p: Pose = {
            ...restPose(
              who,
              EXPRS[Math.floor(rnd() * EXPRS.length)]!,
              undefined,
              acts[Math.floor(rnd() * acts.length)],
            ),
            wob: -28 + 56 * rnd(),
            t: rnd() * 20,
            blink: rnd(),
          }
          if (rnd() < 0.5) p.swing = { neckwear: -20 + 40 * rnd() }
          const tree = draw(who, p, o)
          expect(keys(tree)).toEqual(ref)
          expect(JSON.stringify(tree)).not.toMatch(/NaN|Infinity/)
        }
      }
  })
})

describe('the first live paint', () => {
  /* every attribute write a fresh Live makes over the server frame */
  function firstPaintWrites(name: string, o: Record<string, unknown>) {
    const proto = (globalThis as any).Element.prototype
    const set = proto.setAttribute
    const rm = proto.removeAttribute
    const writes: string[] = []
    motion.reduce = false
    const { who, pose, opts } = settle(name, o, true)
    const tree = draw(who, pose, opts)
    const host = document.createElement('div')
    host.innerHTML = serialize(tree)
    const svg = host.querySelector('svg') as unknown as SVGSVGElement
    proto.setAttribute = function (k: string, v: string) {
      writes.push(`${k}=${v}`)
      return set.call(this, k, v)
    }
    proto.removeAttribute = function (k: string) {
      writes.push(`-${k}`)
      return rm.call(this, k)
    }
    try {
      const l = new Live(
        svg,
        tree,
        who,
        opts,
        'normal',
        undefined,
        o.activity as any,
      )
      l.destroy()
    } finally {
      proto.setAttribute = set
      proto.removeAttribute = rm
    }
    return writes
  }

  test('writes nothing over neckwear or decor', () => {
    for (const name of ['Linh', 'Ada Lovelace']) {
      for (const activity of ['idle', 'working'])
        expect(firstPaintWrites(name, { neckwear: 'scarf', activity })).toEqual(
          [],
        )
      expect(
        firstPaintWrites(name, { neckwear: 'scarf', headwear: 'antenna' }),
      ).toEqual([])
      for (const face of ['freckles', 'mustache'])
        expect(firstPaintWrites(name, { face })).toEqual([])
      expect(firstPaintWrites(name, { neckwear: 'badge' })).toEqual([])
    }
  })
})

describe('mustache follows the mouth skew', () => {
  const tf = (mk: number) => {
    const { who, pose, opts } = settle('Ada', { size: 300, face: 'mustache' })
    who.persona.add = { ...who.persona.add, mk }
    const tree = draw(who, pose, opts)
    return find(tree, 'wear.decor.mustache')!.attrs.transform!
  }

  test('no skew leaves the plain translate, a skew turns it about the mouth', () => {
    expect(tf(0)).not.toContain('rotate')
    expect(tf(13)).toMatch(/rotate\(13\)/)
    expect(tf(-13)).toMatch(/rotate\(-13\)/)
  })
})
