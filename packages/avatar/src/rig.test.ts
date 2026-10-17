import { afterEach, describe, expect, test } from 'bun:test'
import { draw, type Pose } from './draw'
import { mulberry32 } from './identity'
import {
  defineAccessory,
  registerPlugins,
  resetPluginsForTests,
} from './plugins'
import { REACTIONS } from './reactions'
import { FRAME_LIMITS, frames, Rig } from './rig'
import { type AvatarOptions, serialize, settle } from './svg'
import { GROUPS } from './tables'

afterEach(() => resetPluginsForTests())

/** A Rig settled like a live avatar, on a seeded random source. */
function rig(name: string, o: AvatarOptions = {}, s = 7) {
  const { who, opts } = settle(name, o, true)
  return new Rig(
    who,
    opts,
    {
      expression: o.expression ?? 'normal',
      activity: o.activity ?? 'idle',
      gaze: o.gaze,
    },
    mulberry32(s),
  )
}
const run = (r: Rig, n: number, dt = 1 / 60) => {
  for (let i = 0; i < n; i++) r.step(dt)
}
const CHANNELS = Object.values(GROUPS).flat()
const channels = (p: Pose) => CHANNELS.map((c) => p[c as keyof Pose] as number)

describe('frames()', () => {
  test('ten deterministic, distinct frames for a working second', () => {
    const a = frames('Linh', { activity: 'working' }, { fps: 10, seconds: 1 })
    const b = frames('Linh', { activity: 'working' }, { fps: 10, seconds: 1 })
    expect(a).toHaveLength(10)
    expect(a).toEqual(b)
    expect(new Set(a).size).toBe(10)
    for (const f of a) expect(f.startsWith('<svg')).toBe(true)
  })

  test('the first frame is the server frame of the live tree', () => {
    const o: AvatarOptions = { activity: 'thinking', expression: 'happy' }
    const { who, pose, opts } = settle('Linh', o, true)
    const f = frames('Linh', o, { fps: 30, seconds: 0.5 })
    expect(f).toHaveLength(15)
    expect(f[0]).toBe(serialize(draw(who, pose, opts)))
  })

  test('a reaction plays in the frames and never touches Math.random', () => {
    const real = Math.random
    Math.random = () => {
      throw new Error('Math.random called')
    }
    try {
      const plain = frames(
        'Linh',
        { expression: 'sad' },
        { fps: 20, seconds: 2 },
      )
      const hop = frames(
        'Linh',
        { expression: 'sad', reaction: 'hop' },
        { fps: 20, seconds: 2 },
      )
      expect(hop[0]).toBe(plain[0]!)
      expect(hop.slice(1, 10)).not.toEqual(plain.slice(1, 10))
    } finally {
      Math.random = real
    }
  })

  test('FRAME_LIMITS caps the work and names the limit it hits', () => {
    expect(FRAME_LIMITS).toEqual({
      maxFrames: 600,
      minFps: 1,
      maxFps: 120,
      maxSeconds: 60,
    })
    const at = (fps: number, seconds: number) => () =>
      frames('Linh', {}, { fps, seconds })
    expect(at(121, 1)).toThrow(RangeError)
    expect(at(121, 1)).toThrow(/maxFps/)
    expect(at(0.5, 1)).toThrow(/minFps/)
    expect(at(0, 1)).toThrow(/minFps/)
    expect(at(Number.NaN, 1)).toThrow(/minFps/)
    expect(at(1, 61)).toThrow(/maxSeconds/)
    expect(at(1, Number.POSITIVE_INFINITY)).toThrow(/maxSeconds/)
    expect(at(1, -1)).toThrow(RangeError)
    // 30 fps for 30 s is 900 frames: inside each rate, over the total
    expect(at(30, 30)).toThrow(/maxFrames/)
    expect(at(120, 5)).not.toThrow()
    expect(frames('Linh', {}, { fps: 120, seconds: 5 })).toHaveLength(600)
    expect(frames('Linh', {}, { fps: 10, seconds: 0 })).toEqual([])
  })

  test('a reaction never reaches settle: the frames match without it', () => {
    const o: AvatarOptions & { reaction: 'hop' } = { reaction: 'hop' }
    const f = frames('Linh', o, { fps: 10, seconds: 0.1 })
    const { who, pose, opts } = settle('Linh', {}, true)
    expect(f[0]).toBe(serialize(draw(who, pose, opts)))
    expect(o).toEqual({ reaction: 'hop' })
  })
})

describe('Rig', () => {
  test('returns to the activity pose after a reaction', () => {
    const a = rig('Linh', { activity: 'working' })
    const b = rig('Linh', { activity: 'working' })
    run(a, 30)
    run(b, 30)
    a.react('hop')
    run(a, 10)
    run(b, 10)
    expect(channels(a.pose())).not.toEqual(channels(b.pose()))
    // the hop is over well before this: the springs and loop agree again
    run(a, Math.ceil(REACTIONS.hop.dur * 60) + 60)
    run(b, Math.ceil(REACTIONS.hop.dur * 60) + 60)
    const pa = channels(a.pose())
    const pb = channels(b.pose())
    for (let i = 0; i < pa.length; i++) expect(pa[i]!).toBeCloseTo(pb[i]!, 6)
    expect(a.pose().fx).toBe(b.pose().fx)
  })

  test('the injected random drives blinks, saccades and the sigh', () => {
    const real = Math.random
    Math.random = () => {
      throw new Error('Math.random called')
    }
    try {
      const a = rig('Linh', { expression: 'sad' }, 1)
      const b = rig('Linh', { expression: 'sad' }, 1)
      const c = rig('Linh', { expression: 'sad' }, 2)
      const seen = { a: [] as number[], b: [] as number[], c: [] as number[] }
      for (let i = 0; i < 600; i++) {
        a.step(1 / 60)
        b.step(1 / 60)
        c.step(1 / 60)
        seen.a.push(a.pose().gx, a.pose().blink)
        seen.b.push(b.pose().gx, b.pose().blink)
        seen.c.push(c.pose().gx, c.pose().blink)
      }
      expect(seen.a).toEqual(seen.b)
      expect(seen.a).not.toEqual(seen.c)
    } finally {
      Math.random = real
    }
  })

  test('aim is in frame coordinates; null lets go', () => {
    const r = rig('Linh')
    run(r, 120)
    const rest = r.pose().gx
    for (let i = 0; i < 120; i++) r.step(1 / 60, { aim: [340, 120] })
    expect(r.pose().gx).toBeGreaterThan(0.3)
    for (let i = 0; i < 240; i++) r.step(1 / 60, { aim: null })
    expect(Math.abs(r.pose().gx - rest)).toBeLessThan(0.3)
  })

  test('a fixed gaze set later is followed', () => {
    const r = rig('Linh')
    r.setGaze([1, 1])
    run(r, 240)
    expect(r.pose().gy).toBeGreaterThan(0.5)
    r.setGaze(null)
    run(r, 240)
    expect(r.pose().gy).toBeLessThan(0.5)
  })

  test('each pose owns its swing: two poses differ during a hop', () => {
    const r = rig('Linh', { headwear: 'antenna', neckwear: 'scarf' })
    r.react('hop')
    let differ = 0
    let prev = r.pose()
    for (let i = 0; i < 30; i++) {
      r.step(1 / 60)
      const p = r.pose()
      expect(p.swing).toBeDefined()
      expect(p.swing).not.toBe(prev.swing)
      if (p.swing!.headwear !== prev.swing!.headwear) differ++
      prev = p
    }
    expect(differ).toBeGreaterThan(10)
  })

  test('a registered physics hat gets its own spring', () => {
    registerPlugins([
      defineAccessory({
        slot: 'headwear',
        name: 'bobble',
        physics: { stiffness: 6, damping: 0.1, maxSwing: 30 },
        draw: () => [],
      }),
    ])
    const r = rig('Linh', { headwear: 'bobble' })
    expect(r.pose().swing).toEqual({ headwear: 0 })
    r.react('hop')
    let peak = 0
    let apart = 0
    for (let i = 0; i < 40; i++) {
      r.step(1 / 60)
      const p = r.pose()
      peak = Math.max(peak, Math.abs(p.swing!.headwear!))
      // its own spring, not the body swing the trait rides
      apart = Math.max(apart, Math.abs(p.swing!.headwear! - p.wob))
    }
    expect(peak).toBeGreaterThan(0.05)
    expect(apart).toBeGreaterThan(0.01)
    // without a sprung item there is no swing at all
    expect(rig('Linh', { headwear: 'crown' }).pose().swing).toBeUndefined()
  })

  test('pulse and setActivity, setExpression act on the pose', () => {
    const r = rig('Linh', { activity: 'speaking' })
    run(r, 30)
    r.pulse(1)
    r.step(1 / 60)
    expect(r.pose().voice).toBeGreaterThan(0)
    r.setActivity('idle')
    r.step(1 / 60)
    expect(r.pose().voice).toBe(-1)
    expect(r.pose().activity).toBe('idle')
    r.setExpression('happy')
    expect(r.pose().expression).toBe('happy')
  })
})
