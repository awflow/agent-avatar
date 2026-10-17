import { describe, expect, test } from 'bun:test'
import { ARIA, fromLegacy, lookForRole } from './compat'
import * as entry from './index'
import { toSvg } from './svg'

const base = { color: '#123456' }
describe('fromLegacy', () => {
  test('theme, color, none parts', () => {
    const o = fromLegacy(base)
    expect(o).toMatchObject({
      theme: 'bold',
      color: '#123456',
      brows: 'none',
      mouth: 'none',
      cheeks: 'none',
      trait: 'none',
    })
  })
  test('shapes', () => {
    expect(fromLegacy({ ...base, shape: 'pebble' }).shape).toBe('circle')
    for (const s of ['cube', 'peak', 'drop', 'gem', 'cloud', 'ghost'])
      expect(fromLegacy({ ...base, shape: s }).shape).toBe(s as never)
    expect('shape' in fromLegacy(base)).toBe(false)
  })
  test('motif', () => {
    expect(fromLegacy({ ...base, motif: 'dots' }).motif).toBe('dots')
    expect(fromLegacy({ ...base, motif: 'rays' }).motif).toBe('plain')
    expect(fromLegacy(base).motif).toBe('plain')
  })
  test('eyes', () => {
    const m = {
      pills: 'pill',
      dots: 'dot',
      round: 'oval',
      sleepy: 'bead',
      spark: 'spark',
    }
    for (const [k, v] of Object.entries(m))
      expect(fromLegacy({ ...base, eyes: k }).eyes).toBe(v as never)
    expect(fromLegacy(base).eyes).toBe('pill')
  })
  test('accessories', () => {
    expect(fromLegacy({ ...base, acc: 'glasses' }).eyewear).toBe('glasses')
    for (const a of ['beanie', 'headphones', 'antenna', 'bow'])
      expect(fromLegacy({ ...base, acc: a }).headwear).toBe(a as never)
    const none = fromLegacy({ ...base, acc: 'none' })
    expect('headwear' in none || 'eyewear' in none).toBe(false)
  })
})

describe('lookForRole', () => {
  test('travel', () => {
    expect(lookForRole('Plan my trip to Lisbon')).toMatchObject({
      shape: 'drop',
      color: '#4f86f7',
      motif: 'dots',
      headwear: 'headphones',
      eyes: 'pill',
    })
  })
  test('role defaults and overrides', () => {
    expect(lookForRole('check my inbox')).toMatchObject({
      shape: 'peak',
      color: '#5b5bd6',
      motif: 'plain',
      eyes: 'pill',
    })
    expect(lookForRole('do research')).toMatchObject({
      eyes: 'oval',
      eyewear: 'glasses',
      shape: 'circle',
    })
  })
  test('no match', () => {
    expect(lookForRole('zzz')).toEqual({})
  })
})

describe('ARIA', () => {
  test('draws clean with her orange', () => {
    const svg = toSvg('Aria', ARIA)
    expect(svg).not.toMatch(/NaN|Infinity|undefined/)
    expect(svg).toContain('#f08a24')
  })
  test('main entry stays free of compat', () => {
    expect('fromLegacy' in entry).toBe(false)
    expect('ARIA' in entry).toBe(false)
  })
})
