import { describe, expect, test } from 'bun:test'
import { ACTIVITIES, type Activity } from '../activity'
import { Live } from '../animate'
import { draw, loopPhase, type Node } from '../draw'
import { serialize, settle, toSvg } from '../svg'
import { FACES, PROPS as PROP_LIST } from '../tables'
import { fakeDom, motion } from '../test/dom'
import { PROPS } from './props'

fakeDom()

const NAMES = [
  'magnifier',
  'pencil',
  'coffee',
  'bulb',
  'book',
  'wrench',
] as const
const ACTS = Object.keys(ACTIVITIES) as Activity[]
const SHAPES = Object.keys(FACES) as (keyof typeof FACES)[]

const flat = (n: Node): Node[] => [n, ...n.children.flatMap(flat)]
const keys = (n: Node) => flat(n).map((c) => c.key)
const find = (n: Node, key: string) => flat(n).find((c) => c.key === key)
const propKeys = (n: Node) => keys(n).filter((k) => k.startsWith('wear.prop.'))

function held(o: Record<string, unknown>, live = false) {
  const { who, pose, opts } = settle('Ada', { size: 300, ...o }, live)
  return { who, pose, opts, tree: draw(who, pose, { ...opts, live }) }
}

describe('registry', () => {
  test('six props, one per listed name past none', () => {
    expect(Object.keys(PROPS).sort()).toEqual([...NAMES].sort())
    expect(PROP_LIST.filter((p) => p !== 'none').sort()).toEqual(
      [...NAMES].sort(),
    )
    for (const k of NAMES) expect(typeof PROPS[k].draw).toBe('function')
  })
})

describe('each prop is clean', () => {
  for (const name of NAMES)
    test(`${name} × 10 activities × 15 shapes`, () => {
      for (const activity of ACTS)
        for (const shape of SHAPES) {
          const o = { prop: name, activity, shape } as any
          expect(toSvg('Ada', o)).not.toMatch(/NaN|Infinity|undefined|null/)
          expect(toSvg('Ada', { ...o, framing: 'full' })).not.toMatch(
            /NaN|Infinity|undefined|null/,
          )
          const { tree } = held(o, true)
          const node = find(tree, `wear.prop.${name}`)
          expect(node).toBeDefined()
          for (const c of flat(node!))
            expect(c.key.startsWith(`wear.prop.${name}`)).toBe(true)
          expect(flat(node!).length).toBeGreaterThan(1)
        }
    })
})

describe('level of detail', () => {
  test('hidden under 44px, drawn from 44px', () => {
    for (const name of NAMES) {
      for (const size of [20, 30, 40, 43]) {
        expect(propKeys(held({ prop: name, size }).tree)).toEqual([])
        expect(propKeys(held({ prop: name, size }, true).tree)).toEqual([])
      }
      expect(
        propKeys(held({ prop: name, size: 44 }).tree).length,
      ).toBeGreaterThan(0)
    }
  })

  test('no prop, no prop nodes, and no bytes change', () => {
    expect(propKeys(held({}).tree)).toEqual([])
    // not even an empty layer on a live tree: peek@1's live tree holds
    expect(keys(held({}, true).tree)).not.toContain('prop')
    expect(keys(held({ prop: 'bulb', size: 40 }, true).tree)).toContain('prop')
    expect(toSvg('Ada', { prop: 'none' as any })).toBe(toSvg('Ada'))
  })
})

describe('the live tree', () => {
  test('keeps its nodes across activities and clocks', () => {
    for (const name of NAMES)
      for (const size of [40, 64, 300]) {
        const ref = keys(held({ prop: name, size }, true).tree)
        for (const activity of ACTS) {
          const { who, pose, opts } = settle(
            'Ada',
            { prop: name, size, activity } as any,
            true,
          )
          for (const t of [0, 0.4, 0.9, 3.1])
            expect(keys(draw(who, { ...pose, t }, opts))).toEqual(ref)
        }
      }
  })
})

describe('placement', () => {
  test('floats bottom-right in frame space, bobbing and rocking', () => {
    const { who, pose, opts } = settle('Ada', {
      prop: 'book',
      size: 300,
    } as any)
    for (const t of [0, 0.9, 2.5]) {
      const node = find(draw(who, { ...pose, t }, opts), 'wear.prop.book')!
      const tt = t + loopPhase(who.key)
      const m =
        /^translate\(([\d.-]+) ([\d.-]+)\) rotate\(([\d.-]+)\) scale\(3\.4\)$/.exec(
          node.attrs.transform!,
        )!
      expect(m).not.toBe(null)
      expect(Number(m[1])).toBe(279)
      expect(Number(m[2])).toBeCloseTo(265 + 4 * Math.sin(2.2 * tt + 1), 1)
      expect(Number(m[3])).toBeCloseTo(-10 + 4 * Math.sin(1.4 * tt), 1)
    }
  })

  test('outside the body group, under the fx layer', () => {
    for (const framing of ['peek', 'full'])
      for (const name of NAMES) {
        const { tree } = held(
          { prop: name, activity: 'thinking', framing },
          true,
        )
        const all = keys(tree)
        const av = all.indexOf('av')
        const prop = all.indexOf(`wear.prop.${name}`)
        const fx = all.indexOf('fx')
        expect(av).toBeGreaterThanOrEqual(0)
        expect(prop).toBeGreaterThan(av)
        expect(fx).toBeGreaterThan(prop)
        expect(find(find(tree, 'av')!, `wear.prop.${name}`)).toBe(undefined)
        // under full framing it follows the body, like the fx
        const framed = find(tree, 'framing')
        if (framing === 'full')
          expect(find(framed!, `wear.prop.${name}`)).toBeDefined()
        else expect(framed).toBe(undefined)
      }
  })
})

describe('activity reactions', () => {
  test('the bulb lights, with a halo, only while thinking or done', () => {
    for (const activity of ACTS) {
      const { tree } = held({ prop: 'bulb', activity })
      const lit = activity === 'thinking' || activity === 'done'
      expect(find(tree, 'wear.prop.bulb.halo') !== undefined).toBe(lit)
      expect(find(tree, 'wear.prop.bulb.glass')!.attrs.fill).toBe(
        lit ? '#F9D976' : '#FFFDF8',
      )
    }
  })

  test('coffee steam rises and fades on its own loop', () => {
    const { who, pose, opts } = settle(
      'Ada',
      { prop: 'coffee', size: 300 } as any,
      true,
    )
    const phase = loopPhase(who.key)
    for (const t of [0.1, 0.5, 1.7]) {
      const steam = find(
        draw(who, { ...pose, t }, opts),
        'wear.prop.coffee.steam',
      )!
      const st = (((0.8 * (t + phase)) % 1) + 1) % 1
      expect(Number(steam.attrs.opacity ?? 1)).toBeCloseTo(1 - st, 2)
    }
  })

  test('outlines follow the theme ink, accents stay', () => {
    const soft = serialize(held({ prop: 'magnifier' }).tree)
    const neon = serialize(held({ prop: 'magnifier', theme: 'neon' }).tree)
    expect(soft).toContain('#BDE1E5')
    expect(neon).toContain('#BDE1E5')
    const ring = (t: Node) => find(t, 'wear.prop.magnifier.rim')!.attrs.stroke
    expect(ring(held({ prop: 'magnifier' }).tree)).not.toBe(
      ring(held({ prop: 'magnifier', theme: 'neon' }).tree),
    )
  })
})

describe('first paint', () => {
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

  test('the first live paint writes nothing over a held prop', () => {
    for (const name of ['Linh', 'Ada Lovelace'])
      for (const activity of ['idle', 'thinking', 'working', 'done'])
        for (const prop of NAMES)
          for (const framing of ['peek', 'full'])
            expect(
              firstPaintWrites(name, { prop, activity, framing, size: 120 }),
            ).toEqual([])
  })
})
