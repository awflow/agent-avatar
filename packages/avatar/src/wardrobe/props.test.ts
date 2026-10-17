import { describe, expect, test } from 'bun:test'
import { ACTIVITIES, type Activity } from '../activity'
import { Live } from '../animate'
import { draw, loopPhase, type Node } from '../draw'
import { serialize, settle, toSvg } from '../svg'
import { FACES, PROPS as PROP_LIST } from '../tables'
import { bounds, mul, parseT } from '../test/bounds'
import { fakeDom, motion } from '../test/dom'
import { HELD_PROPS } from './props'

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

type Box = { x0: number; y0: number; x1: number; y1: number }
/** A node's box in frame space, through every transform above it. */
function absBox(tree: Node, key: string): Box {
  const walk = (n: Node, m: ReturnType<typeof parseT>): Box | undefined => {
    if (n.key === key) {
      // lids are clipped to the eye: the eye shows no further than its socket
      const seen = (c: Node): Node => ({
        ...c,
        children: c.children.filter((k) => !k.key.endsWith('.lids')).map(seen),
      })
      const [x0, y0, x1, y1] = bounds(seen(n), m)
      return { x0: x0!, y0: y0!, x1: x1!, y1: y1! }
    }
    const mm = mul(m, parseT(n.attrs.transform))
    for (const c of n.children) {
      const b = walk(c, mm)
      if (b) return b
    }
    return undefined
  }
  const b = walk(tree, parseT(''))
  if (!b) throw new Error(`no ${key}`)
  return b
}
/** The body group's vertical offset at rest (peek framing). */
const absTy = (tree: Node) =>
  Number(
    /^translate\([\d.-]+ ([\d.-]+)\)/.exec(
      find(tree, 'av')!.attrs.transform!,
    )![1],
  )

function held(o: Record<string, unknown>, live = false) {
  const { who, pose, opts } = settle('Ada', { size: 300, ...o }, live)
  return { who, pose, opts, tree: draw(who, pose, { ...opts, live }) }
}

describe('registry', () => {
  test('six props, one per listed name past none', () => {
    expect(Object.keys(HELD_PROPS).sort()).toEqual([...NAMES].sort())
    expect(PROP_LIST.filter((p) => p !== 'none').sort()).toEqual(
      [...NAMES].sort(),
    )
    for (const k of NAMES) expect(typeof HELD_PROPS[k].draw).toBe('function')
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
  test('beside the body, at or below the cheek line, bobbing and rocking', () => {
    for (const shape of SHAPES) {
      const { who, pose, opts } = settle('Ada', {
        prop: 'book',
        size: 300,
        shape,
      } as any)
      const at = (t: number) => {
        const node = find(draw(who, { ...pose, t }, opts), 'wear.prop.book')!
        const m =
          /^translate\(([\d.-]+) ([\d.-]+)\) rotate\(([\d.-]+)\) scale\(([\d.]+)\)$/.exec(
            node.attrs.transform!,
          )!
        expect(m).not.toBe(null)
        return m.slice(1).map(Number) as [number, number, number, number]
      }
      const bob = (t: number) =>
        4 * Math.sin(2.2 * (t + loopPhase(who.key)) + 1)
      const ref = at(0.9)
      const y0 = ref[1] - bob(0.9)
      for (const t of [0, 0.9, 2.5]) {
        const [x, y, r, k] = at(t)
        const tt = t + loopPhase(who.key)
        // the spot holds; only the bob and the rock move
        expect(x).toBe(ref[0])
        expect(k).toBe(ref[3])
        expect(y - bob(t)).toBeCloseTo(y0, 1)
        expect(r).toBeCloseTo(-10 + 4 * Math.sin(1.4 * tt), 1)
      }
      const f = FACES[shape]
      const { tree } = held({ prop: 'book', shape })
      // the right half, at or below the cheek line (frame space)
      expect(ref[0]).toBeGreaterThan(220)
      // a face whose cheek line sits within a prop of the frame's bottom
      // (the semicircle) holds it up beside the eyes instead
      const cheek = f.cheeks[1][1] + absTy(tree)
      if (cheek < 340 - 60) expect(y0).toBeGreaterThanOrEqual(cheek - 0.5)
      expect(ref[3]).toBeGreaterThanOrEqual(3.4 * 0.5 - 0.01)
      expect(ref[3]).toBeLessThanOrEqual(3.4)
    }
  })

  test('keeps at least 0.75 of the mock size on every shape and frame', () => {
    for (const square of [true, false])
      for (const framing of ['peek', 'full'])
        for (const shape of SHAPES)
          for (const name of ['Ada', 'Linh', 'Zed Okafor']) {
            const { tree } = (() => {
              const { who, pose, opts } = settle(name, {
                prop: 'book',
                size: 300,
                shape,
                framing,
                square,
              } as any)
              return { tree: draw(who, pose, opts) }
            })()
            const k = Number(
              /scale\(([\d.]+)\)$/.exec(
                find(tree, 'wear.prop.book')!.attrs.transform!,
              )![1],
            )
            expect(k).toBeGreaterThanOrEqual(3.4 * 0.75 - 0.01)
          }
  })

  test('never covers the face, stays in the visible or round frame', () => {
    const bad: string[] = []
    const hit = (a: Box, b: Box) =>
      a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
    for (const square of [true, false])
      for (const who0 of ['Ada', 'Linh', 'Zed Okafor'])
        for (const shape of SHAPES)
          for (const framing of ['peek', 'full'])
            for (const expression of ['normal', 'surprised'])
              for (const name of NAMES) {
                const { who, pose, opts } = settle(who0, {
                  prop: name,
                  size: 300,
                  shape,
                  framing,
                  expression,
                  square,
                  brows: 'arch',
                  activity: name === 'coffee' ? 'idle' : 'thinking',
                } as any)
                for (const t of [0, 0.9, 1.7, 3.3]) {
                  const tree = draw(who, { ...pose, t }, opts)
                  const p = absBox(tree, `wear.prop.${name}`)
                  const where = `${who0}: ${name} on ${shape} ${framing} ${expression} square=${square} t=${t}`
                  for (const k of ['eye0', 'eye1', 'brow0', 'brow1', 'mouth']) {
                    const fb = absBox(tree, k)
                    if (hit(p, fb))
                      bad.push(`${where} covers ${k}: ${JSON.stringify(p)}`)
                  }
                  // inside the visible frame (the viewBox), and inside a
                  // round frame's clip circle; full framing is measured
                  // through the framing transform, so the same bounds hold
                  if (p.x0 < -30 || p.y0 < -30 || p.x1 > 370 || p.y1 > 370)
                    bad.push(`${where} leaves the frame: ${JSON.stringify(p)}`)
                  if (!square)
                    for (const [cx, cy] of [
                      [p.x0, p.y0],
                      [p.x1, p.y0],
                      [p.x0, p.y1],
                      [p.x1, p.y1],
                    ] as const)
                      if (Math.hypot(cx - 170, cy - 170) > 200)
                        bad.push(
                          `${where} leaves the round frame: ${JSON.stringify(p)}`,
                        )
                }
              }
    expect(bad).toEqual([])
  }, 60_000)

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
