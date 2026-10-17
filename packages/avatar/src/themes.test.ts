import { describe, expect, test } from 'bun:test'
import { toSvg } from './svg'
import { COLORS, EXPRESSIONS, type Expression } from './tables'
import { defineTheme, parseHex, THEMES, themeOf } from './themes'

const NAMES = ['Ada Lovelace', 'Linh', 'Đoàn', '東京']
const idOf = (svg: string) => /id="((?:peek|awf)-[^"]*?)-f"/.exec(svg)?.[1]

describe('themes', () => {
  test('soft theme keeps peek@1 bytes', () => {
    for (const name of NAMES)
      for (const expression of Object.keys(EXPRESSIONS) as Expression[])
        for (const size of [48, 300])
          expect(
            toSvg(name, { expression, size, version: 1, theme: 'soft' }),
          ).toBe(toSvg(name, { expression, size, version: 1 }))
  })

  test('every theme draws every colour clean', () => {
    for (const theme of Object.keys(THEMES))
      for (const color of Object.keys(COLORS) as (keyof typeof COLORS)[]) {
        const svg = toSvg('Linh', { theme, color })
        expect(svg).not.toMatch(/NaN|Infinity|undefined/)
      }
  })

  test('12 colour slots', () => {
    expect(Object.keys(COLORS).slice(7)).toEqual([
      'peach',
      'sky',
      'sage',
      'sand',
      'plum',
    ])
    for (const t of Object.values(THEMES))
      expect(Object.keys(t.colors)).toEqual(Object.keys(COLORS))
  })

  test('hex colours', () => {
    expect(parseHex('#ABC')).toBe('#aabbcc')
    expect(parseHex('#aabbcc')).toBe('#aabbcc')
    expect(parseHex('red')).toBeNull()
    expect(parseHex('#zzzzzz')).toBeNull()
    expect(toSvg('Linh', { color: '#4f86f7' })).toContain('#4f86f7')
    expect(toSvg('Linh', { color: 'red' as any })).toBe(toSvg('Linh'))
  })

  test('themes change ids', () => {
    expect(idOf(toSvg('Linh', { theme: 'soft' }))).not.toBe(
      idOf(toSvg('Linh', { theme: 'bold' })),
    )
  })

  test('defineTheme registers', () => {
    defineTheme({ ...THEMES.soft, name: 'test' })
    expect(themeOf('test').name).toBe('test')
    expect(themeOf('nope')).toBe(THEMES.soft)
  })
})
