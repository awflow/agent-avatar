import { afterEach, describe, expect, test } from 'bun:test'
import { lookPrompt, lookSchema, parseLook } from './ai'
import type { CharacterCtx } from './character'
import { draw, type Node } from './draw'
import { mulberry32 } from './identity'
import { el } from './node'
import {
  type CharacterPlugin,
  defineCharacter,
  registerPlugins,
  resetPluginsForTests,
} from './plugins'
import { frames, Rig } from './rig'
import { settle, toSvg } from './svg'
import { FACES } from './tables'

const flat = (n: Node): Node[] => [n, ...n.children.flatMap(flat)]
const tree = (name: string, o: Parameters<typeof settle>[1], live = false) => {
  const { who, pose, opts } = settle(name, o, live)
  return draw(who, pose, opts)
}
const avOf = (t: Node) => flat(t).find((x) => x.key === 'av')!.attrs.transform!
const framingOf = (t: Node) => {
  const tf = flat(t).find((x) => x.key === 'framing')!.attrs.transform!
  const [, s, c] = /scale\(([\d.]+)\) translate\(-170 (-?[\d.]+)\)/.exec(tf)!
  return { s: Number(s), c: -Number(c) }
}

let seen: CharacterCtx | undefined
const blob = (over: Partial<Omit<CharacterPlugin, 'kind'>> = {}) =>
  defineCharacter({
    name: 'blob',
    geom: FACES.circle,
    draw: (c) => {
      seen = c
      return { body: [el('circle', 'shell', { cx: 170, cy: 170, r: 150 })] }
    },
    ...over,
  })

afterEach(() => {
  resetPluginsForTests()
  seen = undefined
})

describe('spin turns in place', () => {
  test('past 20 degrees the pivot slides to the body centre, built-ins too', () => {
    for (const shape of ['circle', 'triangle', 'diamond'] as const) {
      const { who, opts } = settle('Linh', { shape, size: 240 }, true)
      const rig = new Rig(
        who,
        opts,
        { expression: 'normal', activity: 'idle' },
        mulberry32(1),
      )
      rig.react('spin')
      let mid = ''
      for (let i = 0; i < 40; i++) {
        rig.step(1 / 60)
        if (Math.abs(rig.pose().rot - 180) < 20) mid = avOf(rig.tree())
      }
      const g = FACES[shape]
      const top = Math.min(...g.crown.poly.map(([, y]) => y)) - g.crown.r
      const py = Number(/rotate\(\S+ 170 (\S+)\)/.exec(mid)![1])
      expect(py).toBeCloseTo((top + g.bottom) / 2, 0)
    }
    // a small lean still turns about the feet, so static bytes hold
    const t = tree('Linh', { expression: 'curious', size: 240, version: 1 })
    expect(avOf(t)).toMatch(/rotate\([\d.]+ 170 (320|255|312\.8)\)/)
  })
})

describe('full framing keeps a character whole', () => {
  test('its headroom, highest hop and a whole spin stay inside the frame', () => {
    registerPlugins([
      blob({ headroom: 80 }),
      blob({ name: 'low', lift: 0.4, headroom: 80 }),
    ])
    const scales: number[] = []
    for (const character of ['blob', 'low']) {
      const o = { character, size: 240, framing: 'full' as const }
      const { s, c } = framingOf(tree('Aria', o))
      scales.push(s)
      expect(s).toBeLessThanOrEqual(0.8)
      const R = seen!.unit
      const g = FACES.circle
      const baseY = 370 + g.sink - g.bottom
      const top = 20 + baseY
      const cy = (top + g.bottom + baseY) / 2
      const reach = Math.max(cy - (top - 80), g.bottom + baseY - cy)
      const y = (v: number) => 170 + s * (v - c)
      // the crest at the top of the highest hop, and a spun body
      expect(y(top - 80 - 1.6 * R)).toBeGreaterThanOrEqual(-30)
      expect(y(cy - reach - 0.6 * R)).toBeGreaterThanOrEqual(-30)
      expect(y(cy + reach)).toBeLessThanOrEqual(370)
      expect(y(g.bottom + baseY)).toBeLessThanOrEqual(370)
    }
    // the lower the lift, the less the frame has to give up
    expect(scales[1]!).toBeGreaterThan(scales[0]!)
    // built-in faces keep their framing to the byte
    expect(toSvg('Linh', { framing: 'full' })).toContain('scale(0.8)')
  })

  test('headroom is checked', () => {
    expect(() => blob({ headroom: -1 })).toThrow(
      'character "blob": headroom must be a number from 0 to 400',
    )
  })
})

describe('speech waves', () => {
  test('a character speaks beside its mouth, clear of the eyes', () => {
    registerPlugins([blob()])
    const t = tree('Aria', {
      character: 'blob',
      size: 240,
      activity: 'speaking',
    })
    const ty = Number(/translate\(\S+ (\S+)\)/.exec(avOf(t))![1])
    const waves = flat(t).filter((x) => /^fx\.\d+$/.test(x.key))
    expect(waves.length).toBeGreaterThan(0)
    const g = FACES.circle
    for (const w of waves) {
      const y = Number(/translate\(\S+ (\S+)\)/.exec(w.attrs.transform!)![1])
      // the arcs reach about 16 above their anchor: still below the eyes
      expect(y - 16).toBeGreaterThan(g.eyes[1][1] + g.ry + ty)
    }
  })

  test('a geometry may declare where speech sits; it is checked', () => {
    registerPlugins([blob({ geom: { ...FACES.circle, speech: [300, 280] } })])
    const t = tree('Aria', {
      character: 'blob',
      size: 240,
      activity: 'speaking',
    })
    const w = flat(t).find((x) => x.key === 'fx.0')!
    expect(w.attrs.transform).toMatch(/^translate\(300 /)
    expect(() =>
      blob({ geom: { ...FACES.circle, speech: [1] as any } }),
    ).toThrow('speech must be an [x, y] point')
  })
})

describe('tint', () => {
  test('an explicit colour reaches a character as its tint, a hashed one never', () => {
    registerPlugins([blob()])
    tree('Aria', { character: 'blob', size: 240 })
    expect(seen!.tint).toBe(null)
    tree('Aria', { character: 'blob', size: 240, color: 'rose' })
    expect(seen!.tint).toEqual({ body: '#EFCAD7', deep: '#DFA4BA' })
    tree('Aria', { character: 'blob', size: 240, color: '#f00' })
    expect(seen!.tint!.body).toBe('#ff0000')
    expect(
      settle('Aria', { character: 'blob', color: 'rose' }).opts.id,
    ).not.toBe(settle('Aria', { character: 'blob' }).opts.id)
    // no character, no tint: built-in output holds
    expect(settle('Aria', { color: 'rose' }).opts.tint).toBeUndefined()
  })
})

describe('frames() timeline', () => {
  test('cues change the activity and play reactions at their time', () => {
    const acts: string[] = []
    const reacts: (string | null)[] = []
    registerPlugins([
      blob({
        draw: (c) => {
          acts.push(c.activity)
          reacts.push(c.reaction)
          return { body: [] }
        },
      }),
    ])
    const svgs = frames(
      'Aria',
      {
        character: 'blob',
        size: 64,
        // out of order on purpose: cues apply in time order
        timeline: [
          { at: 1, activity: 'idle' },
          { at: 0.5, activity: 'working' },
          { at: 0.75, reaction: 'hop' },
          { at: 1.2, activity: 'nonsense' as never },
        ],
      },
      { fps: 10, seconds: 1.5 },
    )
    expect(svgs).toHaveLength(15)
    // one draw for settle's tree is not made here: one per frame
    expect(acts).toHaveLength(15)
    expect(acts.slice(0, 5).every((a) => a === 'idle')).toBe(true)
    expect(acts[5]).toBe('working')
    expect(acts[9]).toBe('working')
    expect(acts[10]).toBe('idle')
    // an unknown activity is idle, as the live handle has it
    expect(acts[14]).toBe('idle')
    expect(reacts[8]).toBe('hop')
    expect(() =>
      frames('Aria', { timeline: [{ at: -1 }] }, { fps: 10, seconds: 1 }),
    ).toThrow(RangeError)
    expect(() =>
      frames(
        'Aria',
        { timeline: Array.from({ length: 601 }, () => ({ at: 0 })) },
        { fps: 10, seconds: 1 },
      ),
    ).toThrow('above maxFrames 600')
  })
})

describe('ai', () => {
  test('a character is offered and accepted only by registered name', () => {
    const props = () =>
      (lookSchema() as { properties: Record<string, unknown> }).properties
    expect('character' in props()).toBe(false)
    expect(lookPrompt()).not.toContain('character:')
    expect(parseLook({ character: 'blob' })).toEqual({})
    registerPlugins([blob()])
    expect(props().character).toMatchObject({ enum: ['blob'] })
    expect(lookPrompt()).toContain('character:')
    expect(parseLook({ character: 'blob' })).toEqual({ character: 'blob' })
    expect(parseLook({ character: 'evil' })).toEqual({})
  })
})
