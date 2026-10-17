import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { Activity } from './activity'
import { Live } from './animate'
import { draw, type Node, restPose } from './draw'
import { type AvatarOptions, serialize, settle } from './svg'

/*
 * The rig on a fake DOM: rAF never fires (each test drives step() itself),
 * the IntersectionObserver is inert and reduced motion is a switch.
 */
// one switch for every test file: the rig caches the first query it sees
const g = globalThis as any
g.__motion ??= { reduce: false }
const motion: { reduce: boolean } = g.__motion
beforeAll(() => {
  GlobalRegistrator.register()
  globalThis.requestAnimationFrame = () => 1
  globalThis.cancelAnimationFrame = () => {}
  globalThis.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  } as any
  // the rig caches one query for the page: read the switch live
  globalThis.matchMedia = ((q: string) => ({
    get matches() {
      return motion.reduce && q.includes('reduce')
    },
    addEventListener() {},
  })) as any
})
afterAll(async () => {
  await GlobalRegistrator.unregister()
})

function mount(name: string, o: AvatarOptions = {}, reduced = false) {
  motion.reduce = reduced
  const { who, pose, opts } = settle(name, o, true)
  const tree = draw(who, pose, opts)
  const host = document.createElement('div')
  host.innerHTML = serialize(tree)
  const svg = host.querySelector('svg') as unknown as SVGSVGElement
  const live = new Live(
    svg,
    tree,
    who,
    opts,
    o.expression ?? 'normal',
    o.gaze,
    o.activity,
  )
  const count = () => svg.querySelectorAll('*').length
  return { live, svg, count, who, opts, rig: live as any }
}

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

  test('the first paint writes nothing over the server frame', () => {
    const proto = (globalThis as any).Element.prototype
    const set = proto.setAttribute
    const rm = proto.removeAttribute
    let writes: string[] = []
    motion.reduce = false
    proto.setAttribute = function (k: string, v: string) {
      writes.push(`${k}=${v}`)
      return set.call(this, k, v)
    }
    proto.removeAttribute = function (k: string) {
      writes.push(`-${k}`)
      return rm.call(this, k)
    }
    try {
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
        for (const name of ['Linh', 'Ada Lovelace']) {
          const { who, pose, opts } = settle(
            name,
            { activity, ring: { color: '#F08A24', pulse: true } },
            true,
          )
          const tree = draw(who, pose, opts)
          const host = document.createElement('div')
          host.innerHTML = serialize(tree)
          const svg = host.querySelector('svg') as unknown as SVGSVGElement
          writes = []
          const l = new Live(
            svg,
            tree,
            who,
            opts,
            'normal',
            undefined,
            activity,
          )
          expect(writes).toEqual([])
          l.destroy()
        }
    } finally {
      proto.setAttribute = set
      proto.removeAttribute = rm
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
