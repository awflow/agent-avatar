import { describe, expect, test } from 'bun:test'
import { identify, LISTS } from './identity'
import { settle, toSvg } from './svg'

describe('public options', () => {
  test('shape overrides the silhouette', () => {
    expect(settle('Linh', { shape: 'cube' }).who.face).toBe('cube')
  })
  test('face is a decoration in v2', () => {
    expect(settle('Linh', { face: 'freckles' }).who.decor).toBe('freckles')
    const s = settle('Linh', { face: 'circle' as any })
    expect(s.who.decor).toBe(identify('Linh').decor)
    expect(s.who.face).toBe(identify('Linh').face)
  })
  test("face keeps Peek's meaning in v1", () => {
    expect(settle('Linh', { version: 1, face: 'circle' }).who.face).toBe(
      'circle',
    )
  })
  test('style pins the version', () => {
    expect(toSvg('Linh', { style: 'peek@1' })).toBe(
      toSvg('Linh', { version: 1 }),
    )
    expect(settle('Linh', { style: 'peek@1', version: 2 }).who.version).toBe(2)
  })
  test('unknown values are ignored', () => {
    const base = settle('Linh', {}).who as any
    for (const axis of [...Object.keys(LISTS), 'prop']) {
      const key = axis === 'face' ? 'shape' : axis
      const got = settle('Linh', { [key]: 'nope' } as any).who as any
      expect(got[axis]).toBe(base[axis])
    }
    expect(settle('Linh', { face: 'nope' as any }).who.decor).toBe(base.decor)
  })
  test('prop defaults to none and is never hashed', () => {
    expect(settle('Linh', {}).who.prop).toBe('none')
    expect(settle('Linh', { prop: 'bulb' }).who.prop).toBe('bulb')
    expect(toSvg('Linh', { prop: 'none' })).toBe(toSvg('Linh'))
  })
  test('id prefix', () => {
    expect(toSvg('Linh', { version: 1 })).toContain('id="peek-')
    expect(toSvg('Linh')).toContain('id="awf-')
  })
})
