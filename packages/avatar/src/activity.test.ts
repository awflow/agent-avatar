import { describe, expect, test } from 'bun:test'
import { ACTIVITIES, type Activity, activityLoop, blend } from './activity'
import { toSvg } from './svg'
import { EXPRESSIONS, FACES } from './tables'

const KEYS = Object.keys(ACTIVITIES) as Activity[]

describe('blend', () => {
  test('idle on normal is the expression table', () => {
    expect(blend('normal', 'idle')).toEqual({ ...EXPRESSIONS.normal })
  })
  test('mixes brow arch with a non-normal expression', () => {
    expect(blend('happy', 'working').browArch).toBe((1 + 0.2) / 2)
  })
  test('an activity that sets the mouth bottom wins', () => {
    expect(blend('sad', 'thinking').mb).toBe(0.15)
  })
  test('an activity with no mouth bottom keeps the expression mouth', () => {
    const b = blend('sad', 'speaking')
    expect(b.mb).toBe(EXPRESSIONS.sad.mb)
    expect(b.mt).toBe(EXPRESSIONS.sad.mt)
  })
})

describe('activityLoop', () => {
  test('finite for every activity', () => {
    for (const a of KEYS)
      for (const t of [0, 0.9, 1000])
        for (const v of Object.values(activityLoop(a, t, 0.4)))
          expect(Number.isFinite(v)).toBe(true)
  })
  test('error shivers only early in its cycle', () => {
    expect(activityLoop('error', 1.5, 0).x ?? 0).toBe(0)
    expect(Math.abs(activityLoop('error', 0.02, 0).x!)).toBeGreaterThan(0)
  })
})

describe('toSvg activity', () => {
  test('unknown activity is idle', () => {
    expect(toSvg('Linh', { activity: 'typing' as never })).toBe(toSvg('Linh'))
  })
  test('idle keeps the id', () => {
    expect(toSvg('Linh', { activity: 'idle' })).toBe(toSvg('Linh'))
  })
  test('every activity renders clean on every face and differs from idle', () => {
    for (const face of Object.keys(FACES))
      for (const a of KEYS) {
        const s = toSvg('Linh', { shape: face as never, activity: a })
        expect(s).not.toMatch(/NaN|undefined|Infinity/)
        if (a !== 'idle')
          expect(s).not.toBe(toSvg('Linh', { shape: face as never }))
      }
  })
})
