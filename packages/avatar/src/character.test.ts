import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { ACTIVITIES, type Activity } from './activity'
import { Live } from './animate'
import type { CharacterCtx } from './character'
import { draw, type Node } from './draw'
import { mulberry32, seed } from './identity'
import { activityWeight, defineCharacter as entryDefine } from './index'
import { el } from './node'
import {
  type CharacterPlugin,
  defineCharacter,
  registerPlugins,
  resetPluginsForTests,
} from './plugins'
import { REACTIONS, type Reaction } from './reactions'
import { Rig } from './rig'
import { serialize, settle, toSvg } from './svg'
import { FACES } from './tables'
import { fakeDom } from './test/dom'
import { springsOf } from './wardrobe/context'

fakeDom()

const flat = (n: Node): Node[] => [n, ...n.children.flatMap(flat)]
const keys = (n: Node) => flat(n).map((c) => c.key)
const tree = (name: string, o: Parameters<typeof settle>[1], live = false) => {
  const { who, pose, opts } = settle(name, o, live)
  return draw(who, pose, opts)
}
const rigFor = (name: string, o: Parameters<typeof settle>[1]) => {
  const { who, opts } = settle(name, o, true)
  return new Rig(
    who,
    opts,
    { expression: o.expression ?? 'normal', activity: o.activity ?? 'idle' },
    mulberry32(seed(name, 'rig')),
  )
}

// what the last drawing saw, for the tests that read the context
let seen: CharacterCtx | undefined

const blob = (over: Partial<Omit<CharacterPlugin, 'kind'>> = {}) =>
  defineCharacter({
    name: 'blob',
    geom: FACES.circle,
    physics: { stiffness: 9, damping: 0.3, maxSwing: 20 },
    draw: (c) => {
      seen = c
      const sy = c.g('sy')
      return {
        defs: [
          el('radialGradient', 'grad', { id: `${c.id}-blob` }, [
            el('stop', 'grad.a', { offset: 0, 'stop-color': '#fff' }),
            el('stop', 'grad.b', { offset: 1, 'stop-color': c.ink.body }),
          ]),
        ],
        back: [
          el('circle', 'glow', {
            cx: 170,
            cy: 40,
            r: 20 + 4 * c.g('focus'),
            transform: `rotate(${c.swing} 170 120)`,
          }),
        ],
        body: [
          el('circle', 'shell', {
            cx: 170,
            cy: 170,
            r: 150,
            fill: `url(#${c.id}-blob)`,
          }),
          // small sizes drop the belly, by tier only
          ...(c.tier >= 1
            ? [
                el('ellipse', 'belly', {
                  cx: 170,
                  cy: 260,
                  rx: 70,
                  ry: 40 * sy,
                }),
              ]
            : []),
        ],
        front: [
          el('ellipse', 'wing', {
            cx: 40,
            cy: 220,
            rx: 20,
            ry: 40,
            transform: `rotate(${c.reaction === 'hop' ? 30 * Math.sin(Math.PI * c.reactionP) : 0} 40 200)`,
          }),
        ],
      }
    },
    eye: (_c, e) => [
      el('ellipse', 'iris', { rx: e.rx, ry: e.ry * (1 - e.lid), fill: '#222' }),
      el('circle', 'shine', { cx: -6, cy: -8, r: 5, opacity: e.shine }),
      el('path', 'happy', {
        d: `M-10 0Q0 -12 10 0`,
        opacity: e.happy,
        fill: 'none',
      }),
    ],
    brow: (_c, b) => [
      el('path', 'arc', {
        d: `M${-b.hw} 0Q0 ${b.arch} ${b.hw} 0`,
        'stroke-width': b.weight,
      }),
    ],
    mouth: (_c, m) => [
      el('path', 'w', {
        d: `M${-m.w} 0Q0 ${m.bottom} ${m.w} 0`,
        opacity: 0.5 + m.open / 2,
      }),
    ],
    ...over,
  })

afterEach(() => {
  resetPluginsForTests()
  seen = undefined
})

describe('defineCharacter', () => {
  test('is on the main entry', () => {
    expect(entryDefine).toBe(defineCharacter)
  })

  test('refuses bad names, a missing draw and non-function parts', () => {
    expect(() => blob({ name: 'Blob' })).toThrow('lowercase')
    expect(() => blob({ draw: undefined as any })).toThrow(
      'plugin "blob": draw must be a function',
    )
    expect(() => blob({ eye: 3 as any })).toThrow(
      'plugin "blob": eye must be a function',
    )
    expect(() => blob({ mouth: 'x' as any })).toThrow(
      'plugin "blob": mouth must be a function',
    )
  })

  test('geometry is checked as a shape is, and stored frozen', () => {
    expect(() => blob({ geom: undefined as any })).toThrow(
      'character "blob": geom is missing',
    )
    expect(() =>
      blob({ geom: { ...FACES.circle, body: { d: 'M0 0L1 1M2 2L3 3' } } }),
    ).toThrow('one subpath')
    expect(() =>
      blob({ geom: { ...FACES.circle, rx: Number.NaN } as any }),
    ).toThrow('finite')
    const c = blob()
    expect(Object.isFrozen(c.geom)).toBe(true)
    expect(c.geom).not.toBe(FACES.circle)
  })

  test('parts pin built-in parts only; physics must be a sane spring', () => {
    expect(() => blob({ parts: { eyes: 'laser' as any } })).toThrow(
      'parts.eyes "laser" is not built in',
    )
    expect(() => blob({ parts: { trait: 'dot' } as any })).toThrow(
      'parts may pin eyes, brows, mouth, cheeks only',
    )
    expect(() =>
      blob({ physics: { stiffness: 0, damping: 0.2, maxSwing: 9 } }),
    ).toThrow('physics needs finite numbers')
    expect(blob({ parts: { mouth: 'cat' } }).parts).toEqual({ mouth: 'cat' })
  })

  test('registers beside the other kinds; a name clash with another kind throws', () => {
    registerPlugins([blob()])
    expect(() =>
      registerPlugins([{ kind: 'prop', name: 'blob', draw: () => [] } as any]),
    ).toThrow('"blob" is taken by another plugin')
  })
})

describe('a character on an avatar', () => {
  test('draws its layers, eyes, brows and mouth under plugin.<name>', () => {
    registerPlugins([blob()])
    const t = tree('Aria', { character: 'blob', size: 240 })
    const k = keys(t)
    for (const want of [
      'plugin.blob.grad',
      'plugin.blob.back',
      'plugin.blob.glow',
      'plugin.blob.body',
      'plugin.blob.shell',
      'plugin.blob.belly',
      'plugin.blob.front',
      'plugin.blob.wing',
      'plugin.blob.eye0.iris',
      'plugin.blob.eye1.shine',
      'plugin.blob.brow0.arc',
      'plugin.blob.mouth.w',
    ])
      expect(k).toContain(want)
    // its gradient lands in the svg's defs
    const defs = t.children.find((c) => c.tag === 'defs')!
    expect(keys(defs)).toContain('plugin.blob.grad')
    // no built-in body, skin or trait under a character
    expect(k).not.toContain('body')
    expect(k).not.toContain('trait')
    expect(k.some((x) => x.startsWith('motif'))).toBe(false)
    const svg = serialize(t)
    expect(svg).not.toContain('NaN')
    expect(svg).toContain(
      `url(#${settle('Aria', { character: 'blob', size: 240 }).opts.id}-blob)`,
    )
  })

  test('draw order: back, body, face, front, then wardrobe', () => {
    registerPlugins([blob()])
    const k = keys(
      tree('Aria', { character: 'blob', size: 240, eyewear: 'glasses' }),
    )
    const at = (x: string) => k.indexOf(x)
    expect(at('plugin.blob.back')).toBeLessThan(at('plugin.blob.body'))
    expect(at('plugin.blob.body')).toBeLessThan(at('eye0'))
    expect(at('mouth')).toBeLessThan(at('plugin.blob.front'))
    expect(at('plugin.blob.front')).toBeLessThan(at('eyewear'))
  })

  test('an unknown character draws the avatar as without one, warned once', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(toSvg('Aria', { character: 'nope' })).toBe(toSvg('Aria'))
      expect(toSvg('Aria', { character: 'nope' })).toBe(toSvg('Aria'))
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]![0])).toContain('character "nope"')
    } finally {
      warn.mockRestore()
    }
  })

  test('joins the id only when drawn: every other id holds', () => {
    const before = settle('Aria', {}).opts.id
    registerPlugins([blob()])
    expect(settle('Aria', {}).opts.id).toBe(before)
    expect(settle('Aria', { character: 'blob' }).opts.id).not.toBe(before)
    expect(settle('Aria', { character: 'blob' }).who.character).toBe('blob')
    expect('character' in settle('Aria', {}).who).toBe(false)
  })

  test('parts pins win over the hash, options win over the pins', () => {
    registerPlugins([blob({ eye: undefined, parts: { eyes: 'spark' } })])
    expect(settle('Aria', { character: 'blob' }).who.eyes).toBe('spark')
    expect(settle('Aria', { character: 'blob', eyes: 'ring' }).who.eyes).toBe(
      'ring',
    )
    // without a custom eye the built-in one draws, on the character's anchors
    const k = keys(tree('Aria', { character: 'blob', size: 240 }))
    expect(k).toContain('eye0.solid')
  })

  test('wardrobe places on the character anchors', () => {
    registerPlugins([
      blob({
        geom: {
          ...FACES.circle,
          eyes: [
            [100, 150],
            [240, 150],
          ],
        },
      }),
    ])
    const svg = toSvg('Aria', {
      character: 'blob',
      eyewear: 'glasses',
      size: 240,
    })
    // the lenses sit on the character's eye line, not the circle face's
    expect(svg).toMatch(/<ellipse[^>]*cy="150"/)
  })
})

describe('the rig drives a character', () => {
  test('the context carries the activity, tier, focus, breath and the reaction', () => {
    registerPlugins([blob()])
    tree('Aria', { character: 'blob', activity: 'working', size: 240 })
    expect(seen!.activity).toBe('working')
    expect(seen!.tier).toBe(2)
    expect(seen!.g('focus')).toBe(1)
    expect(seen!.breath).toBe(0)
    expect(seen!.reaction).toBe(null)
    tree('Aria', { character: 'blob', activity: 'idle', size: 240 })
    expect(seen!.g('focus')).toBe(0)

    const rig = rigFor('Aria', { character: 'blob', size: 240 })
    rig.react('hop')
    const breaths = new Set<number>()
    for (let i = 0; i < 20; i++) {
      rig.step(1 / 60)
      rig.tree()
      breaths.add(Math.round(seen!.breath * 1000))
    }
    expect(seen!.reaction).toBe('hop')
    expect(seen!.reactionP).toBeGreaterThan(0.3)
    expect(seen!.reactionP).toBeLessThan(0.5)
    expect(breaths.size).toBeGreaterThan(5)
    // the hop's spring reaches the character's own swing
    expect(seen!.swing).not.toBe(0)
    expect(seen!.swing).toBe(rig.pose().swing!.character!)
  })

  test('focus springs in and out with the activity', () => {
    registerPlugins([blob()])
    const rig = rigFor('Aria', { character: 'blob', size: 240 })
    rig.setActivity('thinking')
    const path: number[] = []
    for (let i = 0; i < 90; i++) {
      rig.step(1 / 60)
      path.push(rig.pose().focus)
    }
    // eases, never pops
    expect(path[0]!).toBeLessThan(0.1)
    expect(path[30]!).toBeGreaterThan(0.6)
    expect(path.at(-1)!).toBeCloseTo(1, 1)
    rig.setActivity('idle')
    for (let i = 0; i < 120; i++) rig.step(1 / 60)
    expect(rig.pose().focus).toBeCloseTo(0, 1)
  })

  test('activityWeight eases an activity pose in and the last one out', () => {
    registerPlugins([blob()])
    // a static frame, and a fresh rig, read as settled
    tree('Aria', { character: 'blob', activity: 'waiting', size: 240 })
    expect(activityWeight(seen!, 'waiting')).toBe(1)
    expect(activityWeight(seen!, 'idle')).toBe(0)
    const rig = rigFor('Aria', { character: 'blob', size: 240 })
    rig.step(1 / 60)
    rig.tree()
    expect(activityWeight(seen!, 'idle')).toBe(1)
    rig.setActivity('waiting')
    const w: number[] = []
    for (let i = 0; i < 40; i++) {
      rig.step(1 / 60)
      rig.tree()
      w.push(activityWeight(seen!, 'waiting'))
      // the two weights hand over, never both full, never a gap
      expect(
        activityWeight(seen!, 'waiting') + activityWeight(seen!, 'idle'),
      ).toBeCloseTo(1, 6)
    }
    expect(seen!.from).toBe('idle')
    expect(w[0]!).toBeLessThan(0.05)
    expect(w[13]!).toBeGreaterThan(0.3)
    expect(w[13]!).toBeLessThan(0.7)
    expect(w.at(-1)!).toBe(1)
    // reduced motion snaps: settled at once
    rig.setReduced(true)
    rig.setActivity('done')
    rig.tree()
    expect(activityWeight(seen!, 'done')).toBe(1)
  })

  test('a declared spring joins the wardrobe springs as `character`', () => {
    registerPlugins([blob()])
    expect(springsOf({ character: 'blob' }).character).toEqual({
      stiffness: 9,
      damping: 0.3,
      maxSwing: 20,
    })
    registerPlugins([blob({ name: 'still', physics: undefined })])
    expect(springsOf({ character: 'still' })).toEqual({})
  })
})

describe('node-set stability', () => {
  test('every activity, frame and reaction keeps the same node set', () => {
    registerPlugins([blob()])
    for (const size of [240, 32, 16]) {
      const base = keys(tree('Aria', { character: 'blob', size }, true))
      for (const activity of Object.keys(ACTIVITIES) as Activity[]) {
        const rig = rigFor('Aria', { character: 'blob', size, activity })
        expect(keys(rig.tree())).toEqual(base)
        for (const r of Object.keys(REACTIONS) as Reaction[]) {
          rig.react(r)
          for (let i = 0; i < 12; i++) {
            rig.step(1 / 20)
            expect(keys(rig.tree())).toEqual(base)
          }
        }
      }
    }
  })

  test('SSR parity: the first live paint writes nothing over the server frame', () => {
    registerPlugins([blob()])
    const o = { character: 'blob', size: 240, activity: 'working' as const }
    expect(toSvg('Aria', o)).toBe(toSvg('Aria', o))
    const { who, pose, opts } = settle('Aria', o, true)
    const t = draw(who, pose, opts)
    const host = document.createElement('div')
    host.innerHTML = serialize(t)
    const svg = host.querySelector('svg') as unknown as SVGSVGElement
    const proto = (globalThis as any).Element.prototype
    const set = proto.setAttribute
    const writes: string[] = []
    proto.setAttribute = function (k: string, v: string) {
      writes.push(`${k}=${v}`)
      return set.call(this, k, v)
    }
    try {
      new Live(svg, t, who, opts, 'normal', undefined, 'working').destroy()
    } finally {
      proto.setAttribute = set
    }
    expect(writes).toEqual([])
  })
})

describe('level of detail', () => {
  test('the tier follows the size; the face thins out as for any avatar', () => {
    registerPlugins([blob()])
    const at = (size: number) => {
      const k = keys(tree('Aria', { character: 'blob', size }))
      return { k, tier: seen!.tier }
    }
    const big = at(240)
    expect(big.tier).toBe(2)
    expect(big.k).toContain('plugin.blob.brow0.arc')
    const mid = at(32)
    expect(mid.tier).toBe(1)
    expect(mid.k).not.toContain('brow0')
    expect(mid.k).toContain('plugin.blob.mouth.w')
    const small = at(16)
    expect(small.tier).toBe(0)
    expect(small.k).not.toContain('mouth')
    expect(small.k).not.toContain('plugin.blob.belly')
    // body and eyes stay at every size
    for (const r of [big, mid, small]) {
      expect(r.k).toContain('plugin.blob.shell')
      expect(r.k).toContain('plugin.blob.eye0.iris')
    }
  })
})

describe('a failing character', () => {
  test('a throwing draw shows the plain silhouette, warned once', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      registerPlugins([
        blob({
          draw: () => {
            throw new Error('nope')
          },
        }),
      ])
      for (let i = 0; i < 3; i++) {
        const t = tree('Aria', { character: 'blob', size: 240 })
        const k = keys(t)
        expect(k).toContain('body')
        expect(k).not.toContain('plugin.blob.shell')
        // the eyes still draw
        expect(k).toContain('plugin.blob.eye0.iris')
      }
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]![0])).toContain('"blob" skipped: nope')
    } finally {
      warn.mockRestore()
    }
  })

  test('live: an intermittent throw keeps the node set', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      let calls = 0
      const good = blob()
      registerPlugins([
        blob({
          draw: (c) => {
            calls++
            if (calls % 4 === 0) throw new Error('flaky')
            return good.draw(c)
          },
        }),
      ])
      const rig = rigFor('Aria', { character: 'blob', size: 240 })
      const live = keys(rig.tree())
      // a live tree always carries the silhouette, hidden while it draws
      expect(live).toContain('body')
      const groups = new Set<string>()
      for (let i = 0; i < 12; i++) {
        rig.step(1 / 30)
        const t = rig.tree()
        const k = keys(t)
        // a failed frame empties its groups but keeps them
        for (const g of ['plugin.blob.back', 'plugin.blob.body', 'body'])
          expect(k).toContain(g)
        const body = flat(t).find((x) => x.key === 'body')!
        groups.add(body.attrs.opacity ?? '1')
      }
      expect(groups).toEqual(new Set(['0', '1']))
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })

  test('a throwing eye hides only that eye', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      registerPlugins([
        blob({
          eye: () => {
            throw new Error('blind')
          },
        }),
      ])
      const t = tree('Aria', { character: 'blob', size: 240 }, true)
      const eye = flat(t).find((x) => x.key === 'plugin.blob.eye0')!
      expect(eye.attrs.opacity).toBe('0')
      expect(keys(t)).toContain('plugin.blob.shell')
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })
})
