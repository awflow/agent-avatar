import { describe, expect, test } from 'bun:test'
import type { Activity } from './activity'
import { Live } from './animate'
import { draw, type Node, restPose } from './draw'
import { type AvatarOptions, serialize, settle } from './svg'
import { EXPRESSIONS, type Expression } from './tables'
import { fakeDom, motion, mount } from './test/dom'

fakeDom()

describe('Live.setActivity', () => {
  test('working moves gx over time and keeps the node count', () => {
    const { live, count, rig } = mount('Linh')
    const n = count()
    live.setActivity('working')
    const seen = new Set<string>()
    for (let i = 0; i < 60; i++) {
      live.step(1 / 60)
      seen.add((rig.val.gx + rig.out.gx).toFixed(4))
      expect(count()).toBe(n)
    }
    expect(seen.size).toBeGreaterThan(30)
    // the scan loop rides on top of the blended target
    expect(rig.base.gy).toBeCloseTo(0.35, 6)
    live.destroy()
  })

  test('500 calls in a simulated second leave a short queue', () => {
    const { live, count, rig } = mount('Linh')
    const n = count()
    const acts: Activity[] = ['working', 'thinking', 'speaking', 'done', 'idle']
    for (let i = 0; i < 500; i++) {
      live.setActivity(acts[i % acts.length]!)
      live.step(1 / 500)
    }
    expect(rig.queue.length).toBeLessThanOrEqual(8)
    expect(count()).toBe(n)
    live.destroy()
  })

  test('fx nodes come alive while thinking', () => {
    const { live, svg } = mount('Linh')
    const visible = () =>
      Array.from(svg.querySelectorAll('path')).filter(
        (p) => p.getAttribute('opacity') !== '0',
      ).length
    const before = visible()
    live.setActivity('thinking')
    for (let i = 0; i < 30; i++) live.step(1 / 60)
    expect(visible()).toBeGreaterThan(before)
    live.destroy()
  })

  test('gaze lock: thinking ignores a fixed gaze', () => {
    const { live, rig } = mount('Linh', { gaze: [1, 1] })
    live.setActivity('thinking')
    for (let i = 0; i < 240; i++) live.step(1 / 60)
    expect(rig.val.gy).toBeLessThan(0)
    live.setActivity('speaking')
    for (let i = 0; i < 240; i++) live.step(1 / 60)
    expect(rig.val.gy).toBeGreaterThan(0.5)
    live.destroy()
  })

  test('reduced motion: the pose applies at once, frozen at the static phase', () => {
    const { live, rig, who, opts } = mount('Linh', {}, true)
    live.setActivity('sleeping')
    const rest = restPose(who, 'normal', undefined, 'sleeping')
    expect(rig.val.lid).toBeCloseTo(rest.lid, 6)
    // what the DOM was last given is exactly the static sleeping frame
    const want = new Map<string, Record<string, string>>()
    const flat = (n: Node) => {
      want.set(n.key, n.attrs)
      for (const c of n.children) flat(c)
    }
    flat(draw(who, rest, opts))
    for (const [k, a] of want) expect(rig.prev.get(k)).toEqual(a)
    // the bubbles freeze at the static phase too
    live.setActivity('thinking')
    want.clear()
    flat(draw(who, restPose(who, 'normal', undefined, 'thinking'), opts))
    expect(want.get('fx.0')!.opacity).not.toBe('0')
    for (const [k, a] of want) expect(rig.prev.get(k)).toEqual(a)
    live.destroy()
  })

  /* every attribute write a fresh Live makes over the server frame */
  function firstPaintWrites(
    name: string,
    o: AvatarOptions,
    expression: Expression = 'normal',
  ): string[] {
    const proto = (globalThis as any).Element.prototype
    const set = proto.setAttribute
    const rm = proto.removeAttribute
    const writes: string[] = []
    motion.reduce = false
    const { who, pose, opts } = settle(name, { ...o, expression }, true)
    const tree = draw(who, pose, opts)
    const host = document.createElement('div')
    host.innerHTML = serialize(tree)
    const svg = host.querySelector('svg') as unknown as SVGSVGElement
    proto.setAttribute = function (k: string, v: string) {
      writes.push(`${k}=${v}`)
      return set.call(this, k, v)
    }
    proto.removeAttribute = function (k: string) {
      writes.push(`-${k}`)
      return rm.call(this, k)
    }
    try {
      const l = new Live(svg, tree, who, opts, expression, o.gaze, o.activity)
      l.destroy()
    } finally {
      proto.setAttribute = set
      proto.removeAttribute = rm
    }
    return writes
  }

  test('the first paint writes nothing over the server frame', () => {
    for (const activity of [
      'thinking',
      'working',
      'done',
      'waiting',
      'sleeping',
      'speaking',
      'error',
      'listening',
    ] as Activity[])
      for (const name of ['Linh', 'Ada Lovelace'])
        expect(
          firstPaintWrites(name, {
            activity,
            ring: { color: '#F08A24', pulse: true },
          }),
        ).toEqual([])
  })

  test('the first paint writes nothing under an explicit gaze, locked or not', () => {
    const acts: Activity[] = [
      'thinking',
      'working',
      'waiting',
      'sleeping',
      'offline',
      'idle',
      'speaking',
    ]
    for (const framing of ['peek', 'full'] as const)
      for (const expression of Object.keys(EXPRESSIONS) as Expression[])
        for (const activity of acts) {
          const w = firstPaintWrites(
            'Linh',
            { activity, framing, gaze: [0.5, -0.3] },
            expression,
          )
          if (w.length)
            throw new Error(
              `${framing} ${expression} ${activity}: ${w.join(' ')}`,
            )
        }
  })

  test('a curious face looks at the thing again after a locked activity', () => {
    const { live, rig } = mount('Linh', { expression: 'curious' })
    live.setActivity('thinking')
    expect(rig.lookThing).toBe(false)
    live.setActivity('idle')
    expect(rig.lookThing).toBe(true)
    live.destroy()
  })

  test('starts settled in the activity it was painted with', () => {
    const { rig } = mount('Linh', { activity: 'working' })
    expect(rig.base.gy).toBeCloseTo(0.35, 6)
  })

  test('setRing shows and hides the ring node', () => {
    const { live, svg } = mount('Linh')
    const ring = () =>
      Array.from(svg.querySelectorAll('circle')).find(
        (c) => c.getAttribute('r') === '190',
      )!
    expect(ring().getAttribute('opacity')).toBe('0')
    live.setRing({ color: '#F08A24', pulse: true })
    live.step(1 / 60)
    expect(ring().getAttribute('stroke')).toBe('#F08A24')
    expect(ring().getAttribute('opacity')).not.toBe('0')
    live.setRing(null)
    live.step(1 / 60)
    expect(ring().getAttribute('opacity')).toBe('0')
    live.destroy()
  })
})

describe('accessory physics', () => {
  test('a startled hop swings the sprout, and the node set never changes', () => {
    const { live, count, rig } = mount('Linh', { headwear: 'sprout' } as any)
    const n = count()
    let peak = 0
    live.react('hop')
    for (let i = 0; i < 60; i++) {
      live.step(1 / 60)
      peak = Math.max(peak, Math.abs(rig.swing.angle))
    }
    expect(peak).toBeGreaterThan(0.3)
    expect(count()).toBe(n)
  })

  test('the swing settles back to rest', () => {
    const { live, rig } = mount('Linh')
    live.react('hop')
    for (let i = 0; i < 60 * 8; i++) live.step(1 / 60)
    expect(Math.abs(rig.swing.angle)).toBeLessThan(0.5)
  })

  test('reduced motion keeps wob at 0', () => {
    const { live, rig } = mount('Linh', {}, true)
    live.react('hop')
    live.setActivity('working')
    for (let i = 0; i < 30; i++) live.step(1 / 60)
    expect(rig.swing.angle).toBe(0)
  })
})

describe('Live lip-sync', () => {
  const open = (rig: any) => rig.val.mb + rig.out.mb - (rig.val.mt + rig.out.mt)
  const frames = (live: Live, n: number, dt = 1 / 60) => {
    for (let i = 0; i < n; i++) live.step(dt)
  }

  test('a full voice opens the mouth wider than silence', () => {
    const a = mount('Linh', { activity: 'speaking' })
    a.live.setVoice(() => 1)
    frames(a.live, 10)
    const b = mount('Linh', { activity: 'speaking' })
    b.live.setVoice(() => 0)
    frames(b.live, 10)
    expect(open(a.rig)).toBeGreaterThan(open(b.rig))
    a.live.destroy()
    b.live.destroy()
  })

  test('the voice replaces the built-in flap', () => {
    const { live, rig } = mount('Linh', { activity: 'speaking' })
    live.setVoice(() => 0)
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) {
      live.step(1 / 60)
      seen.add(open(rig).toFixed(3))
    }
    // a silent source holds the mouth still, the flap would move it
    expect(seen.size).toBeLessThan(4)
    live.destroy()
  })

  test('a pulse opens the mouth and decays to closed in 200 ms', () => {
    const { live, rig } = mount('Linh', { activity: 'speaking' })
    live.setVoice(() => 0)
    frames(live, 60)
    const closed = open(rig)
    live.pulse()
    live.step(1 / 120)
    frames(live, 5)
    expect(open(rig)).toBeGreaterThan(closed + 0.2)
    frames(live, 12)
    expect(open(rig)).toBeCloseTo(closed, 1)
    live.destroy()
  })

  test('a pulse alone, with no source, closes after decaying', () => {
    const { live, rig } = mount('Linh', { activity: 'speaking' })
    frames(live, 30)
    live.pulse(0.5)
    frames(live, 3)
    const mid = open(rig)
    frames(live, 14)
    const end = open(rig)
    expect(mid).toBeGreaterThan(end)
    live.destroy()
  })

  test('NaN, infinity and out of range stay finite and clamped', () => {
    for (const v of [NaN, Infinity, -Infinity, 7, -3]) {
      const { live, svg, rig } = mount('Linh', { activity: 'speaking' })
      live.setVoice(() => v)
      frames(live, 20)
      expect(svg.outerHTML).not.toMatch(/NaN|Infinity/)
      expect(Number.isFinite(open(rig))).toBe(true)
      live.destroy()
    }
    const hi = mount('Linh', { activity: 'speaking' })
    hi.live.setVoice(() => 99)
    const one = mount('Linh', { activity: 'speaking' })
    one.live.setVoice(() => 1)
    frames(hi.live, 30)
    frames(one.live, 30)
    expect(open(hi.rig)).toBeCloseTo(open(one.rig), 6)
    hi.live.destroy()
    one.live.destroy()
  })

  test('outside speaking the voice has no effect', () => {
    const a = mount('Linh', { activity: 'listening' })
    a.live.setVoice(() => 1)
    a.live.pulse()
    const b = mount('Linh', { activity: 'listening' })
    for (let i = 0; i < 20; i++) {
      a.live.step(1 / 60)
      b.live.step(1 / 60)
    }
    expect(open(a.rig)).toBeCloseTo(open(b.rig), 6)
    a.live.destroy()
    b.live.destroy()
  })

  test('null removes the source and the node count never changes', () => {
    const { live, count } = mount('Linh', { activity: 'speaking' })
    const n = count()
    live.setVoice(() => 1)
    frames(live, 5)
    live.setVoice(null)
    frames(live, 5)
    expect(count()).toBe(n)
    live.destroy()
  })
})

describe('Live.lookAt', () => {
  function place(svg: SVGSVGElement, left: number) {
    svg.getBoundingClientRect = () =>
      ({
        left,
        top: 0,
        width: 100,
        height: 100,
        right: left + 100,
        bottom: 100,
      }) as DOMRect
  }
  function settleGaze(l: Live & any, n = 120) {
    for (let i = 0; i < n; i++) {
      l.measure()
      l.step(1 / 60)
    }
  }
  const gx = (r: any) => r.val.gx

  test('looks at a Live to its right', () => {
    const a = mount('Linh')
    const b = mount('Ada')
    place(a.svg, 0)
    place(b.svg, 400)
    a.live.lookAt(b.live)
    settleGaze(a.rig)
    expect(gx(a.rig)).toBeGreaterThan(0.3)
    a.live.destroy()
    b.live.destroy()
  })

  test('a destroyed target clears the target without throwing', () => {
    const a = mount('Linh')
    const b = mount('Ada')
    place(a.svg, 0)
    place(b.svg, 400)
    a.live.lookAt(b.live)
    settleGaze(a.rig)
    b.live.destroy()
    expect(() => settleGaze(a.rig, 240)).not.toThrow()
    expect(a.rig.gazeTarget).toBeNull()
    expect(Math.abs(gx(a.rig) - a.rig.base.gx)).toBeLessThan(0.3)
    a.live.destroy()
  })

  test('a detached element clears the target; a connected one is followed', () => {
    const a = mount('Linh')
    place(a.svg, 0)
    const el = document.createElement('div')
    el.getBoundingClientRect = () =>
      ({ left: 400, top: 0, width: 20, height: 20 }) as DOMRect
    a.live.lookAt(el)
    settleGaze(a.rig, 5)
    expect(a.rig.gazeTarget).toBeNull()
    document.body.appendChild(el)
    a.live.lookAt(el)
    settleGaze(a.rig)
    expect(gx(a.rig)).toBeGreaterThan(0.3)
    el.remove()
    settleGaze(a.rig, 2)
    expect(a.rig.gazeTarget).toBeNull()
    a.live.destroy()
  })

  test('a locking activity ignores lookAt; null goes back', () => {
    const a = mount('Linh', { activity: 'thinking' })
    const b = mount('Ada')
    place(a.svg, 0)
    place(b.svg, 400)
    const before = a.rig.base.gx
    a.live.lookAt(b.live)
    settleGaze(a.rig)
    expect(a.rig.aim).not.toBeNull()
    const locked = gx(a.rig) + a.rig.out.gx
    expect(Math.abs(locked - before)).toBeLessThan(0.9)
    const c = mount('Linh')
    place(c.svg, 0)
    c.live.lookAt(b.live)
    settleGaze(c.rig)
    c.live.lookAt(null)
    settleGaze(c.rig, 240)
    expect(Math.abs(gx(c.rig) - c.rig.base.gx)).toBeLessThan(0.3)
    expect(a.live.element).toBe(a.svg)
    for (const m of [a, b, c]) m.live.destroy()
  })
})
