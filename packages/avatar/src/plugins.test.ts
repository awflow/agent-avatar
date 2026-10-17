import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { ACTIVITIES, type Activity } from './activity'
import { draw, type Node, ringWalk, seat } from './draw'
import { FX_POOL } from './fx'
import { identify, LISTS } from './identity'
import { el } from './node'
import {
  defineAccessory,
  defineFx,
  defineProp,
  defineShape,
  type Plugin,
  plugins,
  registerPlugins,
  resetPluginsForTests,
} from './plugins'
import { settle, toSvg } from './svg'
import { EXPRESSIONS, type Expression, FACES, PARTS } from './tables'
import { fakeDom, mount } from './test/dom'
import { defineTheme, THEMES, themeOf } from './themes'
import { springsOf } from './wardrobe/context'

fakeDom()

const flat = (n: Node): Node[] => [n, ...n.children.flatMap(flat)]
const keys = (n: Node) => flat(n).map((c) => c.key)
const tree = (name: string, o: Parameters<typeof settle>[1]) => {
  const { who, pose, opts } = settle(name, o)
  return draw(who, pose, opts)
}

const catEars = defineAccessory({
  slot: 'headwear',
  name: 'cat-ears',
  draw: (c) => {
    const top = c.sh.crown.poly[0]![1] - c.sh.crown.r
    return [
      el('path', 'left', {
        d: `M120 ${top + 10}L135 ${top - 30}L150 ${top + 4}Z`,
        fill: c.ink.body,
        transform: c.bodyTransform,
      }),
      el('path', 'right', {
        d: `M190 ${top + 4}L205 ${top - 30}L220 ${top + 10}Z`,
        fill: c.ink.body,
        transform: c.bodyTransform,
      }),
    ]
  },
})

afterEach(() => resetPluginsForTests())

describe('registerPlugins', () => {
  test('a registered headwear draws under plugin.<name>', () => {
    registerPlugins([catEars])
    const t = tree('Linh', { headwear: 'cat-ears', size: 300 })
    const k = keys(t)
    expect(k).toContain('plugin.cat-ears')
    expect(k).toContain('plugin.cat-ears.left')
    expect(k).toContain('plugin.cat-ears.right')
    const svg = toSvg('Linh', { headwear: 'cat-ears', size: 300 })
    expect(svg).toContain('L135 ')
    expect(svg).not.toContain('NaN')
  })

  test('an unregistered name falls back to what the name picked', () => {
    expect(toSvg('Linh', { headwear: 'cat-ears' as any })).toBe(toSvg('Linh'))
  })

  test('built-in names cannot be replaced, with the exact message', () => {
    expect(() =>
      registerPlugins([defineAccessory({ ...catEars, name: 'cap' })]),
    ).toThrow(new Error('"cap" is a built-in headwear and cannot be replaced'))
    expect(() =>
      registerPlugins([
        defineAccessory({ slot: 'eyewear', name: 'monocle', draw: () => [] }),
      ]),
    ).toThrow('"monocle" is a built-in eyewear and cannot be replaced')
    expect(() =>
      registerPlugins([defineProp({ name: 'coffee', draw: () => [] })]),
    ).toThrow('"coffee" is a built-in prop and cannot be replaced')
    expect(() =>
      registerPlugins([defineFx({ name: 'zzz', shapes: () => [] })]),
    ).toThrow('"zzz" is a built-in fx and cannot be replaced')
    expect(() =>
      registerPlugins([defineShape({ name: 'circle', geom: FACES.circle })]),
    ).toThrow('"circle" is a built-in shape and cannot be replaced')
    expect(() =>
      registerPlugins([
        { kind: 'theme', theme: { ...THEMES.soft, name: 'neon' } },
      ]),
    ).toThrow('"neon" is a built-in theme and cannot be replaced')
    expect(() => defineTheme({ ...THEMES.soft, name: 'mono' })).toThrow(
      '"mono" is a built-in theme and cannot be replaced',
    )
    expect(themeOf('neon')).toBe(THEMES.neon)
    expect(plugins()).toEqual([])
  })

  test('the same object twice is a no-op; another kind with the name throws', () => {
    registerPlugins([catEars, catEars])
    registerPlugins([catEars])
    expect(plugins()).toEqual([catEars])
    // names are one namespace across kinds: node keys are plugin.<name>
    expect(() =>
      registerPlugins([defineProp({ name: 'cat-ears', draw: () => [] })]),
    ).toThrow('"cat-ears" is taken by another plugin')
    // the same name in another slot is another kind of thing too
    expect(() =>
      registerPlugins([defineAccessory({ ...catEars, slot: 'eyewear' })]),
    ).toThrow('"cat-ears" is taken by another plugin')
    expect(plugins()).toEqual([catEars])
  })

  test('HMR: a fresh object with the same kind and name replaces it, warned once', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const kite = defineProp({ name: 'kite', draw: () => [] })
      registerPlugins([catEars, kite])
      const dot = (fill: string) =>
        defineAccessory({
          slot: 'headwear',
          name: 'cat-ears',
          draw: () => [el('circle', 'dot', { cx: 170, cy: 20, r: 9, fill })],
        })
      const v2 = dot('#00aa00')
      registerPlugins([v2])
      // last wins, in place: the order of plugins() holds
      expect(plugins()).toEqual([v2, kite])
      expect(toSvg('Linh', { headwear: 'cat-ears', size: 300 })).toContain(
        'fill="#00aa00"',
      )
      const v3 = dot('#0000aa')
      registerPlugins([v3])
      expect(plugins()).toEqual([v3, kite])
      expect(toSvg('Linh', { headwear: 'cat-ears', size: 300 })).toContain(
        'fill="#0000aa"',
      )
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]![0])).toContain('cat-ears')
    } finally {
      warn.mockRestore()
    }
  })

  test('HMR: a theme re-registered from a fresh object replaces it, listed once', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const a = { ...THEMES.clay, name: 'hot', frame: '#111111' }
      registerPlugins([{ kind: 'theme', theme: a }])
      registerPlugins([{ kind: 'theme', theme: a }])
      expect(plugins()).toHaveLength(1)
      const b = { ...THEMES.clay, name: 'hot', frame: '#222222' }
      registerPlugins([{ kind: 'theme', theme: b }])
      expect(themeOf('hot').frame).toBe('#222222')
      expect(plugins()).toHaveLength(1)
      // defineTheme follows the same rule
      defineTheme({ ...THEMES.clay, name: 'hot', frame: '#333333' })
      expect(themeOf('hot').frame).toBe('#333333')
      // a later, unrelated registration leaves the newest theme in place
      registerPlugins([defineProp({ name: 'kite', draw: () => [] })])
      expect(themeOf('hot').frame).toBe('#333333')
      expect(warn).toHaveBeenCalledTimes(1)
      // built-ins still throw with the exact message
      expect(() => defineTheme({ ...THEMES.soft, name: 'bold' })).toThrow(
        '"bold" is a built-in theme and cannot be replaced',
      )
    } finally {
      warn.mockRestore()
    }
  })

  test('a failing list registers nothing', () => {
    const kite = defineProp({ name: 'kite', draw: () => [] })
    expect(() =>
      registerPlugins([kite, defineAccessory({ ...catEars, name: 'cap' })]),
    ).toThrow()
    expect(plugins()).toEqual([])
  })

  test('bad names are refused', () => {
    for (const name of ['', 'Cat Ears', 'none', '__proto__', 'a.b'])
      expect(() =>
        registerPlugins([defineProp({ name, draw: () => [] })]),
      ).toThrow()
  })

  test('plugins() is read-only', () => {
    registerPlugins([catEars])
    const list = plugins()
    expect(Object.isFrozen(list)).toBe(true)
    expect(() => (list as Plugin[]).push(catEars)).toThrow()
    expect(plugins()).toHaveLength(1)
  })
})

describe('a failing plugin', () => {
  test('a throwing draw is skipped, the SVG stays valid, one warning', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const boom = defineAccessory({
        slot: 'neckwear',
        name: 'boom',
        draw: () => {
          throw new Error('nope')
        },
      })
      registerPlugins([boom])
      const plain = toSvg('Linh', { size: 300 })
      for (let i = 0; i < 5; i++) {
        const svg = toSvg('Linh', { neckwear: 'boom', size: 300 })
        expect(svg.startsWith('<svg')).toBe(true)
        expect(svg.endsWith('</svg>')).toBe(true)
        // nothing of it drawn: same element count as without
        expect(svg.split('<').length).toBe(plain.split('<').length)
        const t = tree('Linh', { neckwear: 'boom', size: 300 })
        expect(keys(t).some((k) => k.startsWith('plugin.boom.'))).toBe(false)
      }
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]![0])).toContain('boom')
    } finally {
      warn.mockRestore()
    }
  })

  test('non-finite output is skipped and warned once', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      registerPlugins([
        defineProp({
          name: 'nan-kite',
          draw: () => [el('circle', 'c', { cx: Number.NaN, cy: 1, r: 2 })],
        }),
        defineFx({
          name: 'nan-fx',
          shapes: () => [
            {
              d: 'M0 0',
              fill: 'red',
              stroke: 'none',
              strokeWidth: Number.POSITIVE_INFINITY,
              opacity: 1,
              transform: '',
            },
          ],
        }),
      ])
      for (let i = 0; i < 3; i++) {
        const svg = toSvg('Linh', {
          prop: 'nan-kite',
          fx: 'nan-fx',
          size: 300,
        })
        expect(svg).not.toContain('NaN')
        expect(svg).not.toContain('Infinity')
      }
      expect(warn).toHaveBeenCalledTimes(2)
    } finally {
      warn.mockRestore()
    }
  })

  test('live: an intermittent throw keeps the node set', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      let calls = 0
      registerPlugins([
        defineAccessory({
          slot: 'headwear',
          name: 'flaky',
          draw: (c) => {
            calls++
            if (calls % 3 === 0) throw new Error('flaky')
            return [
              el('circle', 'dot', { cx: 170, cy: 20, r: 9, fill: c.ink.deep }),
            ]
          },
        }),
      ])
      const { live, count, svg } = mount('Linh', {
        headwear: 'flaky',
        size: 300,
      })
      const n = count()
      live.react('hop')
      let hidden = 0
      for (let i = 0; i < 30; i++) {
        live.step(1 / 60)
        expect(count()).toBe(n)
        const g = svg.querySelector('circle[r="9"]')?.parentElement
        if (g?.getAttribute('opacity') === '0') hidden++
      }
      // the failing frames hide the group instead of dropping it
      expect(hidden).toBeGreaterThan(0)
      expect(warn).toHaveBeenCalledTimes(1)
      live.destroy()
    } finally {
      warn.mockRestore()
    }
  })
})

describe('plugin kinds', () => {
  test('a prop plugin draws where props sit', () => {
    let at: unknown
    registerPlugins([
      defineProp({
        name: 'kite',
        draw: (c) => {
          at = c.propAt
          return [
            el('circle', 'body', { cx: c.propAt!.x, cy: c.propAt!.y, r: 10 }),
          ]
        },
      }),
    ])
    const t = tree('Linh', { prop: 'kite', size: 300 })
    expect(keys(t)).toContain('plugin.kite.body')
    expect(at).toBeDefined()
    // never hashed: no prop, no plugin, same SVG as before registering
  })

  test('an fx plugin draws through the string fx option into the pool', () => {
    registerPlugins([
      defineFx({
        name: 'my-fx',
        shapes: (_t, _p, a) => [
          {
            d: `M${a.headX} ${a.headTop}l10 10`,
            fill: 'none',
            stroke: '#ff0000',
            strokeWidth: 3,
            opacity: 1,
            transform: '',
          },
        ],
      }),
    ])
    const svg = toSvg('Linh', { fx: 'my-fx', size: 300 })
    expect(svg).toContain('stroke="#ff0000"')
    // a live tree keeps the whole pool, the plugin's shape in the first slot
    const live = settle('Linh', { fx: 'my-fx', size: 300 }, true)
    const t = draw(live.who, live.pose, live.opts)
    const pool = flat(t).filter((x) => /^fx\.\d+$/.test(x.key))
    expect(pool).toHaveLength(FX_POOL)
    expect(pool[0]!.attrs.stroke).toBe('#ff0000')
    // a reaction may name it through Pose.fx too
    const { who, pose, opts } = settle('Linh', { size: 300 })
    const out = draw(who, { ...pose, fx: 'my-fx', fxP: 0.5 }, opts)
    expect(JSON.stringify(out)).toContain('#ff0000')
  })

  test('an accessory with physics gets its own spring', () => {
    registerPlugins([
      defineAccessory({
        slot: 'neckwear',
        name: 'cape',
        physics: { stiffness: 7, damping: 0.2, maxSwing: 20 },
        draw: () => [],
      }),
    ])
    expect(springsOf({ neckwear: 'cape' })).toEqual({
      neckwear: { stiffness: 7, damping: 0.2, maxSwing: 20 },
    })
    // a prototype name is not an item
    expect(springsOf({ headwear: 'constructor' })).toEqual({})
    const { live, rig } = mount('Linh', { neckwear: 'cape' })
    expect(Object.keys(rig.swings)).toEqual(['neckwear'])
    live.destroy()
  })

  test('a theme plugin registers with its colours normalised', () => {
    const colors = Object.fromEntries(
      Object.entries(THEMES.soft.colors).map(([k, v]) => [
        k,
        { body: v.body.toUpperCase(), deep: '#ABC' },
      ]),
    ) as typeof THEMES.soft.colors
    registerPlugins([
      {
        kind: 'theme',
        theme: { ...THEMES.soft, name: 'plug', frame: '#FFF', colors },
      },
    ])
    const t = themeOf('plug')
    expect(t.name).toBe('plug')
    expect(t.frame).toBe('#ffffff')
    expect(t.colors.peach.deep).toBe('#aabbcc')
    expect(plugins().map((p) => p.kind)).toEqual(['theme'])
    expect(() =>
      registerPlugins([
        { kind: 'theme', theme: { ...THEMES.soft, name: 'bad', frame: 'red' } },
      ]),
    ).toThrow(/frame/)
  })

  test('defineTheme still works standalone and is a ThemePlugin', () => {
    const p = defineTheme({ ...THEMES.clay, name: 'alone' })
    expect(themeOf('alone').name).toBe('alone')
    expect(p.kind).toBe('theme')
    expect(() => JSON.stringify(p)).not.toThrow()
    // registering the same plugin again is a no-op
    registerPlugins([p])
    expect(themeOf('alone')).toBe(p.theme)
  })
})

describe('shape plugins', () => {
  const squircle = defineShape({
    name: 'squircle',
    geom: {
      ...FACES.cube,
      body: {
        d: 'M90 60Q170 40 250 60Q290 70 300 120L310 330L30 330L40 120Q50 70 90 60Z',
      },
    },
  })

  test('multi-subpath bodies are refused with a clear error', () => {
    expect(() =>
      defineShape({
        name: 'holey',
        geom: { ...FACES.cube, body: { d: 'M0 0L10 0L10 10ZM2 2L4 2L4 4Z' } },
      }),
    ).toThrow('shape "holey": body.d must be one subpath (a single M)')
    expect(() =>
      defineShape({
        name: 'broken',
        geom: { ...FACES.cube, hw: Number.NaN },
      }),
    ).toThrow(/finite/)
  })

  test('renders with all parts, clean, and passes the per-face checks', () => {
    registerPlugins([squircle])
    const exprs = Object.keys(EXPRESSIONS) as Expression[]
    const acts = Object.keys(ACTIVITIES) as Activity[]
    for (const [i, eyes] of PARTS.eyes.entries())
      for (const mouth of PARTS.mouth) {
        const svg = toSvg('Linh', {
          shape: 'squircle',
          eyes,
          mouth,
          brows: PARTS.brows[i % PARTS.brows.length],
          cheeks: PARTS.cheeks[i % PARTS.cheeks.length],
          trait: PARTS.trait[i % PARTS.trait.length],
          expression: exprs[i % exprs.length],
          activity: acts[i % acts.length],
          headwear: 'wizard',
          neckwear: 'scarf',
          size: 300,
        })
        expect(svg).not.toContain('NaN')
        expect(svg).not.toContain('Infinity')
      }
    const sh = squircle.geom
    const s = seat(sh.crown, 0, 0)
    for (const v of [s.x, s.y, s.a]) expect(Number.isFinite(v)).toBe(true)
    expect(Number.isFinite(ringWalk(sh).rest)).toBe(true)
    // the shape is reachable through `shape`, and through `face` under v1
    const t = tree('Linh', { shape: 'squircle', size: 300 })
    expect(JSON.stringify(t)).toContain('M90 60Q170 40')
    expect(toSvg('Linh', { face: 'squircle', version: 1 })).toContain(
      'M90 60Q170 40',
    )
    // live
    const { live, count } = mount('Linh', { shape: 'squircle' })
    const n = count()
    live.react('hop')
    for (let i = 0; i < 10; i++) live.step(1 / 60)
    expect(count()).toBe(n)
    live.destroy()
  })
})

describe('hashing', () => {
  test('identity and default output are unaffected by registration', () => {
    const names = Array.from({ length: 500 }, (_, i) => `agent-${i}`)
    const before = names.map((n) => JSON.stringify(identify(n)))
    const dressed = names.map((n) =>
      JSON.stringify(identify(n, { dress: true })),
    )
    const svgs = names.slice(0, 40).map((n) => toSvg(n, { dress: true }))
    registerPlugins([
      catEars,
      defineProp({ name: 'kite', draw: () => [] }),
      defineFx({ name: 'my-fx', shapes: () => [] }),
      defineShape({ name: 'squash', geom: FACES.blob }),
    ])
    expect(names.map((n) => JSON.stringify(identify(n)))).toEqual(before)
    expect(
      names.map((n) => JSON.stringify(identify(n, { dress: true }))),
    ).toEqual(dressed)
    expect(names.slice(0, 40).map((n) => toSvg(n, { dress: true }))).toEqual(
      svgs,
    )
    expect(LISTS.headwear).not.toContain('cat-ears' as never)
    expect(LISTS.face).not.toContain('squash' as never)
  })
})
