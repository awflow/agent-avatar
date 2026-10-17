import { describe, expect, test } from 'bun:test'
import { DEFAULT_SWING, type Swing, stepSwing } from './physics'

const rest: Swing = { angle: 0, vel: 0 }
const none = { x: 0, y: 0, rot: 0 }

describe('stepSwing', () => {
  test('zero acceleration from rest stays at 0', () => {
    let s = rest
    for (let i = 0; i < 100; i++) s = stepSwing(s, none, 1 / 60)
    expect(s.angle).toBe(0)
    expect(s.vel).toBe(0)
  })

  test('a single impulse swings, then decays below 0.5 degrees within 3 s', () => {
    let s = stepSwing(rest, { x: -4000, y: 0, rot: 0 }, 1 / 60)
    let peak = Math.abs(s.angle)
    for (let i = 0; i < 180; i++) {
      s = stepSwing(s, none, 1 / 60)
      peak = Math.max(peak, Math.abs(s.angle))
    }
    expect(peak).toBeGreaterThan(0.5)
    expect(Math.abs(s.angle)).toBeLessThan(0.5)
  })

  test('the angle never exceeds maxSwing', () => {
    let s = rest
    for (let i = 0; i < 300; i++)
      s = stepSwing(s, { x: -9000, y: 5000, rot: -4000 }, 1 / 60)
    expect(Math.abs(s.angle)).toBeLessThanOrEqual(DEFAULT_SWING.maxSwing)
  })

  test('a huge dt is clamped and stays finite', () => {
    const s = stepSwing(rest, { x: -50, y: 20, rot: 10 }, 10)
    expect(Number.isFinite(s.angle)).toBe(true)
    expect(Number.isFinite(s.vel)).toBe(true)
    expect(s).toEqual(stepSwing(rest, { x: -50, y: 20, rot: 10 }, 0.05))
  })

  test('acceleration to the right swings the other way', () => {
    const s = stepSwing(rest, { x: 80, y: 0, rot: 0 }, 1 / 60)
    expect(s.vel).toBeLessThan(0)
  })
})
