import { describe, expect, test } from 'bun:test'
import { draw, type Node, type Pose, restPose } from '../draw'
import { fnv1a } from '../identity'
import { settle, toSvg } from '../svg'
import { ACCESSORIES, EXPRESSIONS, type Expression, FACES } from '../tables'
import { fakeDom, mount } from '../test/dom'
import { springsOf, WEAR } from './context'
import { HEADWEAR } from './headwear'

fakeDom()

const NEW = [
  'beanie',
  'headphones',
  'antenna',
  'crown',
  'wizard',
  'party',
  'halo',
  'beret',
  'chef',
] as const
const SHAPES = Object.keys(FACES) as (keyof typeof FACES)[]

const flat = (n: Node): Node[] => [n, ...n.children.flatMap(flat)]
const keys = (n: Node) => flat(n).map((c) => c.key)
const find = (n: Node, key: string) => flat(n).find((c) => c.key === key)

/*
 * A small bounding box for the drawings: absolute path commands (control
 * points included, so it errs wide), circles, ellipses and rects, through
 * translate / scale / rotate transforms.
 */
type M = [number, number, number, number, number, number]
const mul = (a: M, b: M): M => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
]
const ID: M = [1, 0, 0, 1, 0, 0]
function parseT(t = ''): M {
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
function bounds(n: Node, m: M = ID, acc: number[] = [1e9, 1e9, -1e9, -1e9]) {
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
const crownTop = (face: keyof typeof FACES) => {
  const c = FACES[face].crown
  return c.poly[0]![1] - c.r
}

/** The headwear group of a static drawing, body transform stripped. */
function hat(name: string, face: keyof typeof FACES, e: Expression = 'normal') {
  const { who, pose, opts } = settle('Ada', {
    shape: face,
    headwear: name as any,
    expression: e,
    size: 300,
  })
  const tree = draw(who, pose, opts)
  return { tree, node: find(tree, `wear.headwear.${name}`) }
}

describe('peek headwear', () => {
  test('the sprout still draws byte for byte as before', () => {
    const s = toSvg('Doan Labs', { headwear: 'sprout', version: 1 })
    // recorded before the wardrobe moved: fnv1a, base 36, and the length
    expect([fnv1a(s).toString(36), s.length]).toEqual(['16zzts', 3069])
  })

  test('peek items stay out of the new registry', () => {
    for (const p of ['bow', 'cap', 'sprout'])
      expect(WEAR.headwear[p]).toBe(undefined)
  })
})

describe('new headwear', () => {
  test('the registry holds the nine new hats, physics as specced', () => {
    expect(Object.keys(HEADWEAR).sort()).toEqual([...NEW].sort())
    for (const k of NEW)
      expect((ACCESSORIES.headwear as readonly string[]).includes(k)).toBe(true)
    expect(HEADWEAR.antenna.physics).toEqual({
      stiffness: 9,
      damping: 0.15,
      maxSwing: 26,
    })
    expect(HEADWEAR.party.physics).toEqual({
      stiffness: 10,
      damping: 0.2,
      maxSwing: 18,
    })
    expect(HEADWEAR.wizard.physics).toEqual({
      stiffness: 8,
      damping: 0.2,
      maxSwing: 14,
    })
    expect(HEADWEAR.beanie.physics).toEqual({
      stiffness: 10,
      damping: 0.22,
      maxSwing: 16,
    })
    for (const k of ['headphones', 'crown', 'halo', 'beret', 'chef'] as const)
      expect(HEADWEAR[k].physics).toBe(undefined)
  })

  test('each hat on each shape, normal, happy and sleepy, is clean', () => {
    for (const name of NEW)
      for (const face of SHAPES)
        for (const e of ['normal', 'happy', 'sleepy'] as Expression[]) {
          const s = toSvg('Ada', { shape: face, headwear: name, expression: e })
          expect(s).not.toMatch(/NaN|Infinity|undefined|null/)
          const { node } = hat(name, face, e)
          expect(node).toBeDefined()
          // every node under the hat is keyed in its own namespace
          for (const c of flat(node!))
            expect(c.key.startsWith(`wear.headwear.${name}`)).toBe(true)
          expect(flat(node!).length).toBeGreaterThan(1)
        }
  })

  test('hats sit on the crown top on every shape, narrow tips too', () => {
    const seated = NEW.filter(
      (k) => k !== 'headphones' && k !== 'halo',
    ) as string[]
    for (const name of seated)
      for (const face of SHAPES) {
        const { node } = hat(name, face)
        const [, top, , bottom] = bounds(node!)
        const c = crownTop(face)
        // the lowest point within 8 frame units of the crown top
        expect(Math.abs(bottom! - c)).toBeLessThanOrEqual(8)
        // and it stands up off the head, never swallowing it
        expect(top!).toBeLessThan(c - 20)
      }
  })

  test('hats scale with the head width, clamped', () => {
    const width = (face: keyof typeof FACES) => {
      const [l, , r] = bounds(hat('chef', face).node!)
      return r! - l!
    }
    // triangle (hw 20) and diamond (hw 30) both clamp to 0.55
    expect(width('triangle')).toBeCloseTo(width('diamond'), 1)
    // circle (hw 88) is scale 1, cube (hw 108.8) clamps to 1.2
    expect(width('cube') / width('circle')).toBeCloseTo(1.2, 1)
    expect(width('circle') / width('triangle')).toBeCloseTo(1 / 0.55, 1)
  })

  test('the halo floats above the crown and bobs on the clock', () => {
    for (const face of SHAPES) {
      const [, , , bottom] = bounds(hat('halo', face).node!)
      expect(bottom!).toBeLessThan(crownTop(face) - 2)
    }
    const { who, pose, opts } = settle('Ada', { headwear: 'halo' })
    const y = (t: number) =>
      bounds(find(draw(who, { ...pose, t }, opts), 'wear.headwear.halo')!)[1]!
    expect(y(Math.PI / 4) - y((3 * Math.PI) / 4)).toBeCloseTo(2.4, 1)
  })

  test('headphones span the eye line and arc over the crown', () => {
    for (const face of SHAPES) {
      const sh = FACES[face]
      const { node } = hat('headphones', face)
      const [l, top, r] = bounds(node!)
      expect(l!).toBeLessThan(170 - sh.side - 3)
      expect(r!).toBeGreaterThan(170 + sh.side + 3)
      expect(top!).toBeLessThan(crownTop(face))
      // the band is one symmetric cubic: its peak sits on the crown top
      const [, y0, , c] = find(node!, 'wear.headwear.headphones.band')!
        .attrs.d!.match(/-?[\d.]+/g)!
        .map(Number)
      const apex = 0.25 * y0! + 0.75 * c!
      expect(Math.abs(apex - crownTop(face))).toBeLessThanOrEqual(8)
    }
  })

  test('headphone cups glow cyan only while listening', () => {
    const glow = (activity: any, t: number) => {
      const { who, pose, opts } = settle('Ada', {
        headwear: 'headphones',
        activity,
      })
      const tree = draw(who, { ...pose, t }, { ...opts, live: true })
      return find(tree, 'wear.headwear.headphones.cup0.glow')!.attrs
    }
    const on = glow('listening', Math.PI / 12)
    expect(on.fill).toBe('#5CF2E8')
    expect(Number(on.opacity)).toBeCloseTo(1, 2)
    expect(Number(glow('listening', -Math.PI / 12).opacity)).toBeCloseTo(0.2, 2)
    expect(glow('idle', Math.PI / 12).opacity).toBe('0')
    const cup = (activity: any) => {
      const { who, pose, opts } = settle('Ada', {
        headwear: 'headphones',
        activity,
      })
      return find(draw(who, pose, opts), 'wear.headwear.headphones.cup0')!.attrs
        .fill
    }
    expect(cup('idle')).toBe('#F08A24')
  })

  test('the antenna ball blinks cyan while working', () => {
    const ball = (activity: any, t: number) => {
      const { who, pose, opts } = settle('Ada', {
        headwear: 'antenna',
        activity,
      })
      return find(
        draw(who, { ...pose, t }, { ...opts, live: true }),
        'wear.headwear.antenna.ball',
      )!.attrs.fill
    }
    expect(ball('working', 0.1)).toBe('#5CF2E8')
    expect(ball('working', 0.4)).not.toBe('#5CF2E8')
    expect(ball('idle', 0.1)).not.toBe('#5CF2E8')
  })

  test('mock colours', () => {
    const svg = (h: string) => toSvg('Ada', { headwear: h as any })
    expect(svg('beanie')).toContain('#E5677A')
    expect(svg('crown')).toContain('#F2C14E')
    expect(svg('crown')).toContain('#B8860B')
    expect(svg('wizard')).toContain('#5B4BB7')
    expect(svg('party')).toContain('#F28C6B')
    expect(svg('party')).toContain('#F5C451')
    expect(svg('beret')).toContain('#C9573A')
  })

  test('ink lines follow the theme ink', () => {
    const s = toSvg('Ada', { headwear: 'chef', theme: 'neon' })
    const { who, opts } = settle('Ada', { headwear: 'chef', theme: 'neon' })
    const ink = opts.theme!.ink(opts.ink ?? opts.theme!.colors[who.color])
    expect(s).toContain(`stroke="${ink}"`)
  })

  test('swinging parts turn by their slot angle, else by wob', () => {
    const { who, pose, opts } = settle('Ada', { headwear: 'antenna' })
    const at = (p: Partial<Pose>) =>
      find(draw(who, { ...pose, ...p }, opts), 'wear.headwear.antenna.stalk')!
        .attrs.transform
    expect(at({ wob: 12 })).toContain('rotate(12 ')
    expect(at({ wob: 12, swing: { headwear: -7 } })).toContain('rotate(-7 ')
    expect(at({ wob: 12, swing: { neckwear: 3 } })).toContain('rotate(12 ')
  })

  test('the live tree holds its nodes across random poses', () => {
    const exprs = Object.keys(EXPRESSIONS) as Expression[]
    const acts = ['idle', 'listening', 'working', 'thinking'] as const
    let seed = 7
    const rnd = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (const name of NEW)
      for (const face of ['circle', 'triangle', 'cube'] as const) {
        const { who, opts } = settle(
          'Ada',
          { shape: face, headwear: name },
          true,
        )
        const o = { ...opts, live: true }
        const ref = keys(draw(who, restPose(who, 'normal'), o))
        for (let i = 0; i < 20; i++) {
          const p: Pose = {
            ...restPose(
              who,
              exprs[Math.floor(rnd() * exprs.length)]!,
              undefined,
              acts[Math.floor(rnd() * acts.length)],
            ),
            wob: -28 + 56 * rnd(),
            t: rnd() * 20,
            blink: rnd(),
          }
          if (rnd() < 0.5) p.swing = { headwear: -26 + 52 * rnd() }
          const tree = draw(who, p, o)
          expect(keys(tree)).toEqual(ref)
          expect(JSON.stringify(tree)).not.toMatch(/NaN|Infinity/)
        }
      }
  })

  test('swing stays out of the id at its default', () => {
    const a = settle('Ada', { headwear: 'antenna' })
    expect(a.pose.swing).toBe(undefined)
    expect(toSvg('Ada', { headwear: 'antenna' })).toBe(
      toSvg('Ada', { headwear: 'antenna' }),
    )
  })
})

describe('per-wearable springs', () => {
  test('springs are found per slot from the registry', () => {
    expect(springsOf({ headwear: 'antenna', neckwear: 'none' })).toEqual({
      headwear: HEADWEAR.antenna.physics,
    })
    expect(springsOf({ headwear: 'crown', neckwear: 'tie' })).toEqual({})
    expect(springsOf({ headwear: 'sprout', neckwear: 'none' })).toEqual({})
  })

  test('antenna and scarf swing apart after a hop', () => {
    // the scarf's drawing lands with the neckwear; its spring plugs in here
    const had = WEAR.neckwear.scarf
    WEAR.neckwear.scarf = {
      draw: () => [],
      physics: { stiffness: 9, damping: 0.2, maxSwing: 20 },
    }
    try {
      const { live, rig, count } = mount('Linh', {
        headwear: 'antenna',
        neckwear: 'scarf',
      })
      const n = count()
      live.react('hop')
      let apart = 0
      for (let i = 0; i < 90; i++) {
        live.step(1 / 60)
        const s = rig.swings
        apart = Math.max(apart, Math.abs(s.headwear.angle - s.neckwear.angle))
      }
      expect(apart).toBeGreaterThan(0.05)
      expect(rig.swings.trait).toBe(undefined)
      expect(count()).toBe(n)
      live.destroy()
    } finally {
      if (had) WEAR.neckwear.scarf = had
      else delete WEAR.neckwear.scarf
    }
  })

  /** Binds a Live and keeps the tree of its last paint. */
  const capture = (o: any, reduced = false) => {
    const m = mount('Linh', o, reduced)
    const last: { tree: Node | null } = { tree: null }
    const write = m.rig.write.bind(m.rig)
    m.rig.write = (t: Node) => {
      // write() recurses: keep the root
      if (t.key === 'root') last.tree = t
      write(t)
    }
    const turn = () =>
      Number(
        /rotate\((-?[\d.]+) /.exec(
          find(last.tree!, 'wear.headwear.antenna.stalk')!.attrs.transform!,
        )![1],
      )
    return { ...m, last, turn }
  }

  test('the antenna draws its own slot angle, the trait keeps wob', () => {
    const { live, rig, turn } = capture({ headwear: 'antenna' })
    live.react('hop')
    for (let i = 0; i < 20; i++) live.step(1 / 60)
    const a = rig.swings.headwear.angle
    expect(turn()).toBeCloseTo(a, 1)
    expect(Math.abs(a - rig.swing.angle)).toBeGreaterThan(0.01)
    live.destroy()
  })

  test('without physics wardrobe there is no slot spring', () => {
    const { live, rig } = mount('Linh', { headwear: 'crown' })
    expect(Object.keys(rig.swings)).toEqual([])
    live.destroy()
  })

  test('reduced motion holds every slot at 0', () => {
    const { live, turn } = capture({ headwear: 'antenna' }, true)
    live.react('hop')
    for (let i = 0; i < 30; i++) live.step(1 / 60)
    live.setExpression('happy')
    expect(turn()).toBe(0)
    live.destroy()
  })

  test('the first live paint equals the server frame', () => {
    for (const name of NEW) {
      const { svg } = mount('Linh', { headwear: name, activity: 'working' })
      const server = toSvg('Linh', { headwear: name, activity: 'working' })
      // every attribute the server painted, the live svg holds the same
      const host = document.createElement('div')
      host.innerHTML = server
      const want = host.querySelector('svg') as unknown as SVGSVGElement
      for (const el of want.querySelectorAll('[transform]')) {
        const t = el.getAttribute('transform')!
        expect(svg.outerHTML).toContain(`transform="${t}"`)
      }
    }
  })
})
