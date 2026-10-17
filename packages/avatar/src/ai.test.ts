import { afterEach, describe, expect, test } from 'bun:test'
import { lookPrompt, lookSchema, parseLook } from './ai'
import { LISTS } from './identity'
import {
  defineAccessory,
  defineProp,
  registerPlugins,
  resetPluginsForTests,
} from './plugins'
import { FACES, PROPS } from './tables'
import { defineTheme, THEMES } from './themes'

afterEach(() => resetPluginsForTests())

const props = () =>
  (lookSchema() as { properties: Record<string, { enum?: string[] }> })
    .properties

describe('lookSchema', () => {
  test('enums come from the lists', () => {
    expect(props().headwear!.enum).toEqual([...LISTS.headwear])
    expect(props().prop!.enum).toEqual([...PROPS])
    expect(props().shape!.enum).toEqual(Object.keys(FACES))
    expect(props().face!.enum).toEqual([...LISTS.decor])
    expect(props().theme!.enum).toEqual(Object.keys(THEMES))
  })
  test('rays stays out of the motif enum', () => {
    expect(props().motif!.enum).not.toContain('rays')
    expect(props().motif!.enum).toContain('dots')
  })
  test('closed, all optional, draft 2020-12', () => {
    const s = lookSchema() as Record<string, unknown>
    expect(s.additionalProperties).toBe(false)
    expect(s.required).toBeUndefined()
    expect(String(s.$schema)).toContain('2020-12')
  })
  test('includes registered plugins and themes at call time', () => {
    registerPlugins([
      defineAccessory({
        slot: 'headwear',
        name: 'plug-hat',
        draw: () => [] as never,
      }),
      defineProp({ name: 'plug-prop', draw: () => [] as never }),
    ])
    defineTheme({ ...THEMES.soft, name: 'plug-theme' })
    expect(props().headwear!.enum).toContain('plug-hat')
    expect(props().prop!.enum).toContain('plug-prop')
    expect(props().theme!.enum).toContain('plug-theme')
  })
  test('color is a slot or a hex pattern', () => {
    const c = (props().color as unknown as { anyOf: Record<string, unknown>[] })
      .anyOf
    expect(c.some((x) => Array.isArray(x.enum))).toBe(true)
    expect(c.some((x) => typeof x.pattern === 'string')).toBe(true)
  })
})

describe('parseLook', () => {
  test('keeps valid, drops unknown keys and values', () => {
    expect(
      parseLook({
        headwear: 'wizard',
        prop: 'coffee',
        eyes: 'bead',
        foo: 1,
        shape: 'star',
      }),
    ).toEqual({ headwear: 'wizard', prop: 'coffee', eyes: 'bead' })
  })
  test('never throws on junk', () => {
    for (const v of [
      'nope',
      null,
      undefined,
      3,
      [],
      { eyes: {} },
      { __proto__: 1 },
    ])
      expect(() => parseLook(v)).not.toThrow()
    expect(parseLook('nope')).toEqual({})
    expect(parseLook({ eyes: {}, toString: 'x', constructor: 'y' })).toEqual({})
  })
  test('hex is normalised, bad hex dropped, slots kept', () => {
    expect(parseLook({ color: '#AbC' })).toEqual({ color: '#aabbcc' })
    expect(parseLook({ color: '#zzz' })).toEqual({})
    expect(parseLook({ color: 'lavender' })).toEqual({ color: 'lavender' })
  })
  test('accepts plugins and rejects rays', () => {
    registerPlugins([
      defineProp({ name: 'plug-prop', draw: () => [] as never }),
    ])
    expect(parseLook({ prop: 'plug-prop', motif: 'rays' })).toEqual({
      prop: 'plug-prop',
    })
  })
})

describe('lookPrompt', () => {
  test('mentions every axis and the JSON-only rule', () => {
    const p = lookPrompt()
    for (const k of Object.keys(props())) expect(p).toContain(k)
    expect(p).toContain('JSON')
    expect(p).toContain('headwear')
    expect(p).not.toContain('rays')
  })
  test('locale is passed along', () => {
    expect(lookPrompt({ locale: 'fr' })).toContain('fr')
  })
})
