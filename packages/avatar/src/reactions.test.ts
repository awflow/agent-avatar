import { describe, expect, test } from 'bun:test'
import { type Activity, activityLoop } from './activity'
import { draw, loopPhase, REST_T, restPose } from './draw'
import { REACTIONS, type Reaction } from './reactions'
import { settle } from './svg'
import { EXPRESSIONS, GROUPS } from './tables'
import { fakeDom, motion, mount } from './test/dom'

fakeDom()

const NAMES = Object.keys(REACTIONS) as Reaction[]
const shown = (rig: any, c: string) => rig.val[c] + rig.out[c]

describe('REACTIONS', () => {
  test('lists the ten reactions in order', () => {
    expect(NAMES).toEqual([
      'nod',
      'shake',
      'wink',
      'hop',
      'spin',
      'shiver',
      'gasp',
      'love',
      'giggle',
      'celebrate',
    ])
  })

  test('every delta is finite across the reaction', () => {
    for (const r of NAMES) {
      expect(REACTIONS[r].dur).toBeGreaterThan(0)
      for (const p of [0, 0.25, 0.5, 0.75, 1])
        for (const v of Object.values(REACTIONS[r].at(p)))
          expect(Number.isFinite(v)).toBe(true)
    }
  })

  test('nod, shake, wink, hop and gasp end on no delta', () => {
    for (const r of ['nod', 'shake', 'wink', 'hop', 'gasp'] as Reaction[])
      for (const [c, v] of Object.entries(REACTIONS[r].at(1)))
        expect([r, c, Math.abs(v!) < 1e-9]).toEqual([r, c, true])
  })

  test('values from the spec', () => {
    expect(REACTIONS.nod.at(0.25).gy).toBeCloseTo(0.5, 9)
    expect(REACTIONS.shake.at(1 / 12).x).toBeCloseTo(4 * 3.4 * (11 / 12), 9)
    expect(REACTIONS.wink.at(0.5).winkR).toBeCloseTo(1, 9)
    expect(REACTIONS.hop.at(0.5)).toMatchObject({ sy: 0.04, sx: -0.02 })
    expect(REACTIONS.hop.at(0.05)).toMatchObject({ sy: -0.08, sx: 0.06 })
    expect(REACTIONS.spin.at(1).rot).toBeCloseTo(360, 9)
    expect(REACTIONS.gasp.at(0.4).eyeS).toBeCloseTo(0.25, 9)
    expect(REACTIONS.love.fx).toBe('hearts')
    expect(REACTIONS.celebrate.fx).toBe('confetti')
    expect(REACTIONS.love.at(0.3).blush).toBe(1)
  })
})

describe('winkR', () => {
  test('is an eyes channel, 0 in every expression', () => {
    expect(GROUPS.eyes as readonly string[]).toContain('winkR')
    for (const e of Object.values(EXPRESSIONS)) expect(e.winkR).toBe(0)
  })

  test('closes the right eye only', () => {
    const { who, pose, opts } = settle('Linh', {})
    const open = draw(who, pose, opts)
    const shut = draw(who, { ...pose, winkR: 1 }, opts)
    const lid = (t: typeof open, k: string): string => {
      let out = ''
      const walk = (n: typeof open) => {
        if (n.key === k) out = JSON.stringify(n.attrs)
        n.children.forEach(walk)
      }
      walk(t)
      return out
    }
    expect(lid(shut, 'eye0.lid')).toBe(lid(open, 'eye0.lid'))
    expect(lid(shut, 'eye1.lid')).not.toBe(lid(open, 'eye1.lid'))
  })
})

describe('per-avatar loop phase', () => {
  test('two names in the same activity sit at different loop offsets', () => {
    const a = settle('Linh', { activity: 'thinking' })
    const b = settle('Ada Lovelace', { activity: 'thinking' })
    expect(loopPhase(a.who.key)).not.toBe(loopPhase(b.who.key))
    expect(loopPhase(a.who.key)).not.toBe(0)
    const la = activityLoop('thinking', REST_T, loopPhase(a.who.key))
    const lb = activityLoop('thinking', REST_T, loopPhase(b.who.key))
    expect(la.gx).not.toBeCloseTo(lb.gx!, 3)
    expect(a.pose.gx).not.toBeCloseTo(b.pose.gx, 3)
    // and live, one frame on
    const A = mount('Linh', { activity: 'thinking' })
    const B = mount('Ada Lovelace', { activity: 'thinking' })
    A.live.step(1 / 60)
    B.live.step(1 / 60)
    expect(A.rig.out.gx).not.toBeCloseTo(B.rig.out.gx, 3)
    A.live.destroy()
    B.live.destroy()
  })

  test('the phase is deterministic', () => {
    expect(loopPhase('linh')).toBe(loopPhase('linh'))
    expect(loopPhase('linh')).toBeGreaterThanOrEqual(0)
    expect(loopPhase('linh')).toBeLessThan(2 * Math.PI)
  })

  test("restPose and Live's first paint agree on a phased loop", () => {
    for (const activity of ['thinking', 'sleeping', 'speaking'] as Activity[]) {
      const { rig, who } = mount('Ada Lovelace', { activity })
      const rest = restPose(who, 'normal', undefined, activity)
      for (const c of Object.values(GROUPS).flat())
        expect([c, shown(rig, c)]).toEqual([
          c,
          expect.closeTo(rest[c], 9) as any,
        ])
      rig.destroy()
    }
  })
})

describe('Live.react', () => {
  test('an unknown name does not throw and changes nothing', () => {
    const { live, rig } = mount('Linh')
    const before = JSON.stringify([...rig.prev])
    expect(() => live.react('dance' as any)).not.toThrow()
    expect(() => live.react(undefined as any)).not.toThrow()
    expect(() => live.react('toString' as any)).not.toThrow()
    expect(rig.reaction ?? null).toBeNull()
    expect(JSON.stringify([...rig.prev])).toBe(before)
    live.destroy()
  })

  test('a new reaction replaces the running one', () => {
    const { live, rig } = mount('Linh')
    live.react('hop')
    for (let i = 0; i < 6; i++) live.step(1 / 60)
    live.react('hop')
    expect(rig.reaction.name).toBe('hop')
    expect(rig.reaction.t0).toBeCloseTo(rig.clock, 9)
    live.react('nod')
    expect(rig.reaction.name).toBe('nod')
    live.destroy()
  })

  test('moves the face while it runs', () => {
    const { live, rig } = mount('Linh')
    const twin = mount('Linh')
    live.react('hop')
    for (let i = 0; i < 24; i++) {
      live.step(1 / 60)
      twin.live.step(1 / 60)
    }
    expect(shown(rig, 'alt') - shown(twin.rig, 'alt')).toBeGreaterThan(0.5)
    live.destroy()
    twin.live.destroy()
  })

  test('after its duration the pose is the activity pose again', () => {
    for (const r of NAMES) {
      const a = mount('Linh', { activity: 'working' })
      const b = mount('Linh', { activity: 'working' })
      for (let i = 0; i < 30; i++) {
        a.live.step(1 / 60)
        b.live.step(1 / 60)
      }
      a.live.react(r)
      const frames = Math.ceil((REACTIONS[r].dur + 1) * 60)
      for (let i = 0; i < frames; i++) {
        a.live.step(1 / 60)
        b.live.step(1 / 60)
      }
      expect(a.rig.reaction ?? null).toBeNull()
      for (const c of Object.values(GROUPS).flat()) {
        if (c === 'gx' || c === 'gy') continue // saccades are random
        expect([
          r,
          c,
          Math.abs(shown(a.rig, c) - shown(b.rig, c)) < 1e-3,
        ]).toEqual([r, c, true])
      }
      a.live.destroy()
      b.live.destroy()
    }
  })

  test('love pours hearts into the fx pool, then lets them go', () => {
    const { live, svg } = mount('Linh')
    const visible = () =>
      Array.from(svg.querySelectorAll('path')).filter(
        (p) => p.getAttribute('opacity') !== '0',
      ).length
    const before = visible()
    live.react('love')
    for (let i = 0; i < 40; i++) live.step(1 / 60)
    expect(visible()).toBeGreaterThan(before)
    for (let i = 0; i < 120; i++) live.step(1 / 60)
    expect(visible()).toBe(before)
    live.destroy()
  })

  test('blush takes the max, not the sum', () => {
    const { live, rig } = mount('Linh', { activity: 'done' })
    for (let i = 0; i < 60; i++) live.step(1 / 60)
    live.react('love')
    for (let i = 0; i < 30; i++) {
      live.step(1 / 60)
      expect(shown(rig, 'blush')).toBeLessThanOrEqual(1 + 1e-9)
      expect(shown(rig, 'blush')).toBeGreaterThanOrEqual(1 - 1e-9)
    }
    live.destroy()
  })

  test('reduced motion: react is a no-op', () => {
    const { live, rig } = mount('Linh', {}, true)
    const before = JSON.stringify([...rig.prev])
    live.react('celebrate')
    expect(rig.reaction ?? null).toBeNull()
    expect(JSON.stringify([...rig.prev])).toBe(before)
    live.destroy()
    motion.reduce = false
  })
})

describe('REACTIONS is frozen', () => {
  test('the table and each entry refuse writes', () => {
    const r = REACTIONS as any
    expect(Object.isFrozen(r)).toBe(true)
    expect(() => {
      r.nod = { dur: 9, at: () => ({}) }
    }).toThrow(TypeError)
    for (const k of NAMES) expect(Object.isFrozen(r[k])).toBe(true)
    expect(() => {
      r.hop.dur = 9
    }).toThrow(TypeError)
    expect(REACTIONS.nod.dur).toBe(0.9)
  })
})
