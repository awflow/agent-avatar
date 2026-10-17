import { describe, expect, test } from 'bun:test'
import { Live } from '../animate'
import { draw, loopPhase, type Node, type Pose, restPose } from '../draw'
import { serialize, settle, toSvg } from '../svg'
import { ACCESSORIES, EXPRESSIONS, type Expression, FACES } from '../tables'
import { fakeDom, motion } from '../test/dom'
import { WEAR } from './context'
import { EYEWEAR } from './eyewear'

fakeDom()

const NEW = ['monocle', 'visor', 'patch', 'cateye'] as const
const SHAPES = Object.keys(FACES) as (keyof typeof FACES)[]
const EXPRS = Object.keys(EXPRESSIONS) as Expression[]

const flat = (n: Node): Node[] => [n, ...n.children.flatMap(flat)]
const keys = (n: Node) => flat(n).map((c) => c.key)
const find = (n: Node, key: string) => flat(n).find((c) => c.key === key)

function worn(name: string, o: Record<string, unknown> = {}) {
  const { who, pose, opts } = settle('Ada', {
    eyewear: name as any,
    size: 300,
    ...o,
  })
  return { who, pose, opts, tree: draw(who, pose, opts) }
}

describe('new eyewear', () => {
  test('the registry holds the four new items, no springs', () => {
    expect(Object.keys(EYEWEAR).sort()).toEqual([...NEW].sort())
    for (const k of NEW) {
      expect((ACCESSORIES.eyewear as readonly string[]).includes(k)).toBe(true)
      expect(WEAR.eyewear[k]).toBe(EYEWEAR[k])
      expect(EYEWEAR[k].physics).toBe(undefined)
    }
    for (const p of ['glasses', 'sunglasses'])
      expect(WEAR.eyewear[p]).toBe(undefined)
  })

  test('each item on each shape in each expression is clean', () => {
    for (const name of NEW)
      for (const face of SHAPES)
        for (const e of EXPRS) {
          const o = { shape: face, eyewear: name, expression: e }
          const s = toSvg('Ada', o)
          expect(s).not.toMatch(/NaN|Infinity|undefined|null/)
          const { tree } = worn(name, o)
          const node = find(tree, `wear.eyewear.${name}`)
          expect(node).toBeDefined()
          for (const c of flat(node!))
            expect(c.key.startsWith(`wear.eyewear.${name}`)).toBe(true)
          expect(flat(node!).length).toBeGreaterThan(2)
        }
  })

  test('mock colours', () => {
    const svg = (e: string) => toSvg('Ada', { eyewear: e as any })
    expect(svg('monocle')).toContain('#C9952A')
    expect(svg('visor')).toContain('#23252F')
    expect(svg('visor')).toContain('#5CF2E8')
    const tint = find(worn('cateye').tree, 'wear.eyewear.cateye.lens0.tint')!
    expect(tint.attrs.fill).toBe('#E5677A')
    expect(tint.attrs.opacity).toBe('0.22')
  })

  test('ink lines follow the theme ink, per avatar', () => {
    // neon inks each body in its own deep tone
    const lines: Record<string, string> = {
      monocle: 'rim',
      visor: 'band',
      patch: 'strap',
      cateye: 'lens0',
    }
    for (const name of NEW) {
      const { who, pose, opts } = settle('Ada', {
        eyewear: name,
        theme: 'neon',
      })
      const ink = opts.theme!.ink(opts.ink ?? opts.theme!.colors[who.color])
      const node = find(
        draw(who, pose, opts),
        `wear.eyewear.${name}.${lines[name]}`,
      )!
      expect(node.attrs.stroke).toBe(ink)
    }
    const { who, pose, opts } = settle('Ada', {
      headwear: 'chef',
      theme: 'neon',
    })
    const ink = opts.theme!.ink(opts.ink ?? opts.theme!.colors[who.color])
    const hat = flat(find(draw(who, pose, opts), 'wear.headwear.chef')!)
    expect(hat.some((c) => c.attrs.stroke === ink)).toBe(true)
  })

  test('the monocle rings the right eye, the patch covers the left', () => {
    for (const face of SHAPES) {
      const sh = FACES[face]
      const { tree } = worn('monocle', { shape: face })
      const ring = find(tree, 'wear.eyewear.monocle.ring')!.attrs
      expect(Math.abs(Number(ring.cx) - sh.eyes[1][0])).toBeLessThan(12)
      expect(Number(ring.r)).toBeGreaterThan(Math.max(sh.rx, sh.ry))
      const p = find(
        worn('patch', { shape: face }).tree,
        'wear.eyewear.patch.eye',
      )!.attrs
      expect(Math.abs(Number(p.cx) - sh.eyes[0][0])).toBeLessThan(12)
      expect(Number(p.rx)).toBeGreaterThan(sh.rx + 4)
      expect(Number(p.ry)).toBeGreaterThan(sh.ry + 4)
    }
  })

  test('the visor hides the real eyes and glows in their place', () => {
    const { tree } = worn('visor')
    const k = keys(tree)
    expect(k.some((x) => /^eye\d/.test(x))).toBe(false)
    expect(serialize(tree)).not.toContain('-e0)')
    expect(find(tree, 'wear.eyewear.visor.band')!.attrs.fill).toBe('#23252F')
    expect(find(tree, 'wear.eyewear.visor.glow1')!.attrs.fill).toBe('#5CF2E8')
  })

  test('the visor glow follows the gaze', () => {
    const { who, pose, opts } = settle('Ada', { eyewear: 'visor', size: 300 })
    const cx = (gx: number) =>
      Number(
        find(draw(who, { ...pose, gx }, opts), 'wear.eyewear.visor.glow0')!
          .attrs.cx,
      )
    const mul = (who.persona.mul as Record<string, number>).gx ?? 1
    // 3 mock units a side, 3.4 frame units to the mock unit
    expect(cx(1) - cx(0)).toBeCloseTo(10.2 * mul, 1)
    expect(cx(0) - cx(-1)).toBeCloseTo(10.2 * mul, 1)
  })

  test('the visor glow squashes with the lid and the blink', () => {
    const { who, pose, opts } = settle('Ada', { eyewear: 'visor', size: 300 })
    const o = { ...opts, live: true }
    const ry = (p: Partial<Pose>) =>
      Number(
        find(draw(who, { ...pose, ...p }, o), 'wear.eyewear.visor.glow0')!.attrs
          .ry,
      )
    const open = ry({ blink: 0 })
    expect(ry({ blink: 0.5 })).toBeLessThan(open * 0.7)
    expect(ry({ blink: 1 })).toBeLessThan(open * 0.2)
    const sleepy = settle('Ada', {
      eyewear: 'visor',
      size: 300,
      expression: 'sleepy',
    })
    expect(
      Number(
        find(draw(who, sleepy.pose, o), 'wear.eyewear.visor.glow0')!.attrs.ry,
      ),
    ).toBeLessThan(open)
  })

  test('the live tree holds its nodes across random poses', () => {
    const acts = ['idle', 'listening', 'working', 'thinking'] as const
    let seed = 11
    const rnd = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (const name of NEW)
      for (const face of ['circle', 'triangle', 'cube', 'peak'] as const) {
        const { who, opts } = settle(
          'Ada',
          { shape: face, eyewear: name },
          true,
        )
        const o = { ...opts, live: true }
        const ref = keys(draw(who, restPose(who, 'normal'), o))
        for (let i = 0; i < 20; i++) {
          const p: Pose = {
            ...restPose(
              who,
              EXPRS[Math.floor(rnd() * EXPRS.length)]!,
              [-1 + 2 * rnd(), -1 + 2 * rnd()],
              acts[Math.floor(rnd() * acts.length)],
            ),
            t: rnd() * 20,
            blink: rnd(),
          }
          const tree = draw(who, p, o)
          expect(keys(tree)).toEqual(ref)
          expect(JSON.stringify(tree)).not.toMatch(/NaN|Infinity/)
        }
      }
  })
})

describe('wardrobe z-order', () => {
  /*
   * Inside the body group: eyes, brows, eyewear, headwear, neckwear. After
   * the body group: the layers that live outside it, in paint order. The
   * props task appends its layer to AFTER_BODY.
   */
  const AFTER_BODY = ['fx']
  // live, so the after-body layers keep their nodes when empty
  const live = (name: string, o: Record<string, unknown>) => {
    const { who, pose, opts } = worn(name, o)
    return draw(who, pose, { ...opts, live: true })
  }
  const order = (tree: Node, ks: string[]) => {
    const all = keys(tree)
    return ks.map((k) => all.indexOf(k))
  }
  // the after-body layers paint over the body group, never inside it
  const outside = (tree: Node) => {
    const av = find(tree, 'av')!
    for (const k of AFTER_BODY) expect(find(av, k)).toBe(undefined)
  }
  const ascending = (xs: number[]) => {
    for (const x of xs) expect(x).toBeGreaterThanOrEqual(0)
    for (let i = 1; i < xs.length; i++)
      expect(xs[i]!).toBeGreaterThan(xs[i - 1]!)
  }

  test('headphones, glasses, a scarf and the after-body layers', () => {
    const tree = live('glasses', {
      headwear: 'headphones',
      neckwear: 'scarf',
      brows: 'arch',
    })
    ascending(
      order(tree, [
        'eye0',
        'brow0',
        'eyewear',
        'wear.headwear.headphones',
        'wear.neckwear.scarf',
        'wear.neckwear.scarf.tail',
        ...AFTER_BODY,
      ]),
    )
    outside(tree)
  })

  test('new eyewear sits under Peek headwear, Peek neckwear on top', () => {
    const tree = live('monocle', {
      headwear: 'cap',
      neckwear: 'tie',
      brows: 'arch',
    })
    ascending(
      order(tree, [
        'eye0',
        'brow0',
        'wear.eyewear.monocle',
        'headwear',
        'neckwear',
        ...AFTER_BODY,
      ]),
    )
    outside(tree)
  })
})

describe('the phased wardrobe clock', () => {
  const haloY = (name: string, t: number) => {
    const { who, pose, opts } = settle(name, {
      shape: 'circle',
      headwear: 'halo',
    })
    const node = find(draw(who, { ...pose, t }, opts), 'wear.headwear.halo')!
    return Number(
      /translate\(-?[\d.]+ (-?[\d.]+)\)/.exec(node.attrs.transform!)![1],
    )
  }

  test('two avatars at the same clock do not bob in step', () => {
    expect(loopPhase('ada')).not.toBe(loopPhase('linh'))
    expect(haloY('Ada', 0.9)).not.toBeCloseTo(haloY('Linh', 0.9), 2)
  })

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

  test('the first live paint writes nothing over a halo or the new eyewear', () => {
    for (const name of ['Linh', 'Ada Lovelace'])
      for (const activity of ['idle', 'working', 'listening']) {
        expect(firstPaintWrites(name, { headwear: 'halo', activity })).toEqual(
          [],
        )
        expect(
          firstPaintWrites(name, { headwear: 'headphones', activity }),
        ).toEqual([])
        expect(
          firstPaintWrites(name, { headwear: 'antenna', activity }),
        ).toEqual([])
        for (const e of NEW)
          expect(firstPaintWrites(name, { eyewear: e, activity })).toEqual([])
      }
  })
})
