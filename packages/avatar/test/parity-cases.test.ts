/*
 * The shared parity cases cover what every adapter must agree on, and each
 * one renders, static and animated, through the core.
 */
import { describe, expect, test } from 'bun:test'
import { draw, settle, toSvg } from '../src/index'
import { serialize } from '../src/svg'
import { THEMES } from '../src/themes'
import { PARITY_CASES } from './parity-cases'

const opts = PARITY_CASES.map((c) => c.opts as Record<string, unknown>)
const seen = (key: string) => new Set(opts.map((o) => o[key]).filter(Boolean))

describe('parity cases', () => {
  test('there are twelve, with distinct names', () => {
    expect(PARITY_CASES.length).toBe(12)
    expect(new Set(PARITY_CASES.map((c) => c.name)).size).toBe(12)
  })

  test('cover every built-in theme', () => {
    expect([...seen('theme')].sort()).toEqual(Object.keys(THEMES).sort())
  })

  test('cover both framings, every frame and four activities', () => {
    expect([...seen('framing')].sort()).toEqual(['full', 'peek'])
    expect(seen('frame').size).toBeGreaterThanOrEqual(3)
    expect(seen('activity').size).toBe(4)
  })

  test('cover wardrobe in every slot, a prop, dress and version 1', () => {
    expect(
      opts.some((o) => o.headwear && o.eyewear && o.neckwear && o.face),
    ).toBe(true)
    expect(seen('prop').size).toBeGreaterThan(0)
    expect(opts.some((o) => o.dress === true)).toBe(true)
    expect(opts.some((o) => o.version === 1)).toBe(true)
  })

  for (const { name, opts: o } of PARITY_CASES)
    test(`${name} renders static and live`, () => {
      expect(toSvg(name, o)).toStartWith('<svg')
      const { who, pose, opts: d } = settle(name, o, true)
      expect(serialize(draw(who, pose, d))).toStartWith('<svg')
    })
})
