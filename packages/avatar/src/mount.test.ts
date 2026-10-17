import { describe, expect, spyOn, test } from 'bun:test'
import { Live, liveCount } from './animate'
import { draw, type Gaze } from './draw'
import { attach, isIdentityChange, type MountOptions, mount } from './mount'
import { serialize, settle, toSvg } from './svg'
import { fakeDom, motion } from './test/dom'

fakeDom()

/** What the browser makes of an SVG string, for byte-level comparisons. */
const parsed = (svg: string) => {
  const host = document.createElement('div')
  host.innerHTML = svg
  return host.innerHTML
}

const liveMarkup = (o: MountOptions) => {
  const { name, animate: _a, reaction: _r, reactKey: _k, gaze, ...rest } = o
  const fixed = Array.isArray(gaze) ? (gaze as Gaze) : undefined
  const { who, pose, opts } = settle(name, { ...rest, gaze: fixed }, true)
  return serialize(draw(who, pose, opts))
}

const ssr = (o: MountOptions) => {
  const host = document.createElement('div')
  host.innerHTML = o.animate
    ? liveMarkup(o)
    : toSvg(o.name, { ...o, gaze: undefined } as never)
  document.body.append(host)
  return { host, svg: host.querySelector('svg') as unknown as SVGSVGElement }
}

/** Drives the shared loop by hand: rAF callbacks are queued, then run. */
function frames() {
  let queue: FrameRequestCallback[] = []
  const prev = globalThis.requestAnimationFrame
  let t = performance.now()
  globalThis.requestAnimationFrame = (cb) => {
    queue.push(cb)
    return queue.length
  }
  return {
    advance(n: number) {
      for (let i = 0; i < n; i++) {
        const q = queue
        queue = []
        t += 16
        for (const cb of q) cb(t)
      }
    },
    restore() {
      globalThis.requestAnimationFrame = prev
    },
  }
}

describe('mount', () => {
  test('non-animated: the bytes of toSvg', () => {
    motion.reduce = false
    const target = document.createElement('div')
    target.innerHTML = '<p>old</p>'
    const h = mount(target, { name: 'Ada', size: 128, expression: 'happy' })
    expect(target.innerHTML).toBe(
      parsed(toSvg('Ada', { size: 128, expression: 'happy' })),
    )
    expect(target.firstElementChild as unknown).toBe(h.element)
    expect(liveCount().all).toBe(0)
    h.destroy()
  })

  test('animated: the serialized live tree, with a Live bound to it', () => {
    const before = liveCount().all
    const target = document.createElement('div')
    const o: MountOptions = { name: 'Ada', animate: true, activity: 'working' }
    const h = mount(target, o)
    expect(target.innerHTML).toBe(parsed(liveMarkup(o)))
    expect(target.innerHTML).not.toBe(parsed(toSvg('Ada', o as never)))
    expect(liveCount().all).toBe(before + 1)
    h.destroy()
    expect(liveCount().all).toBe(before)
  })

  test('ring is state: same <svg>, forwarded to setRing', () => {
    const target = document.createElement('div')
    const h = mount(target, { name: 'Ada', animate: true })
    const svg = h.element
    const ring = spyOn(Live.prototype, 'setRing')
    try {
      h.set({ ring: { color: '#4f86f7', progress: 0.5 } })
      expect(ring).toHaveBeenCalledTimes(1)
      expect(ring.mock.calls[0]![0]).toEqual({
        color: '#4f86f7',
        progress: 0.5,
      })
      expect(h.element).toBe(svg)
      expect(target.innerHTML).toContain('#4f86f7')
    } finally {
      ring.mockRestore()
      h.destroy()
    }
  })

  test('activity is state: the same <svg> element', () => {
    const target = document.createElement('div')
    const h = mount(target, { name: 'Ada', animate: true })
    const svg = h.element
    const before = liveCount().all
    h.set({ activity: 'done' })
    h.set({ expression: 'happy', gaze: [1, 0] })
    expect(h.element).toBe(svg)
    expect(target.firstElementChild as unknown).toBe(svg)
    expect(liveCount().all).toBe(before)
    h.destroy()
  })

  test('static state changes re-render in place', () => {
    const target = document.createElement('div')
    const h = mount(target, { name: 'Ada' })
    const svg = h.element
    h.set({ expression: 'happy', ring: { color: '#4f86f7' } })
    expect(h.element).toBe(svg)
    expect(target.innerHTML).toBe(
      parsed(toSvg('Ada', { expression: 'happy', ring: { color: '#4f86f7' } })),
    )
    h.destroy()
  })

  test('identity change: a new <svg>, the old Live replaced', () => {
    const target = document.createElement('div')
    const h = mount(target, { name: 'Ada', animate: true })
    const svg = h.element
    const before = liveCount().all
    h.set({ shape: 'cube' })
    expect(h.element).not.toBe(svg)
    expect(target.firstElementChild as unknown).toBe(h.element)
    expect(svg.isConnected).toBe(false)
    expect(liveCount().all).toBe(before)
    expect(target.innerHTML).toBe(
      parsed(liveMarkup({ name: 'Ada', animate: true, shape: 'cube' })),
    )
    h.destroy()
  })

  test('destroy() during a reaction: frames run clean, no Live left', () => {
    const loop = frames()
    try {
      const before = liveCount()
      const target = document.createElement('div')
      document.body.append(target)
      const h = mount(target, { name: 'Ada', animate: true })
      loop.advance(2)
      h.react('celebrate')
      loop.advance(3)
      h.destroy()
      expect(() => loop.advance(10)).not.toThrow()
      expect(liveCount()).toEqual(before)
      // a destroyed handle ignores everything
      expect(() => {
        h.set({ activity: 'done' })
        h.react('nod')
        h.pulse()
        h.lookAt(null)
        h.destroy()
      }).not.toThrow()
      expect(liveCount()).toEqual(before)
      target.remove()
    } finally {
      loop.restore()
    }
  })

  test('reaction + reactKey fire on a key change after mount, never on mount', () => {
    const react = spyOn(Live.prototype, 'react')
    try {
      const target = document.createElement('div')
      const h = mount(target, {
        name: 'Ada',
        animate: true,
        reaction: 'nod',
        reactKey: 1,
      })
      expect(react).not.toHaveBeenCalled()
      h.set({ reactKey: 1 })
      expect(react).not.toHaveBeenCalled()
      h.set({ reactKey: 2 })
      expect(react).toHaveBeenCalledWith('nod')
      h.set({ reaction: undefined, reactKey: 3 })
      expect(react).toHaveBeenCalledTimes(1)
      h.destroy()
    } finally {
      react.mockRestore()
    }
  })

  test('lookAt another handle follows it across its identity change', () => {
    const a = mount(document.createElement('div'), {
      name: 'Ada',
      animate: true,
    })
    const b = mount(document.createElement('div'), {
      name: 'Linh',
      animate: true,
    })
    const look = spyOn(Live.prototype, 'lookAt')
    try {
      a.lookAt(b)
      const first = look.mock.calls.at(-1)![0]
      expect(first).toBeInstanceOf(Live)
      b.set({ shape: 'cube' })
      const second = look.mock.calls.at(-1)![0]
      expect(second).toBeInstanceOf(Live)
      expect(second).not.toBe(first)
    } finally {
      look.mockRestore()
      a.destroy()
      b.destroy()
    }
  })

  test('style: peek@N pins the version', () => {
    const target = document.createElement('div')
    mount(target, { name: 'Ada', style: 'peek@1' }).destroy()
    expect(target.innerHTML).toBe(parsed(toSvg('Ada', { version: 1 })))
  })
})

describe('attach', () => {
  test('adopts SSR markup: no new element, a Live bound in place', () => {
    const o: MountOptions = { name: 'Ada', animate: true, activity: 'thinking' }
    const { host, svg } = ssr(o)
    const html = host.innerHTML
    const create = spyOn(document, 'createElement')
    try {
      const before = liveCount().all
      const h = attach(svg, o)
      expect(create).not.toHaveBeenCalled()
      expect(h.element).toBe(svg)
      expect(host.innerHTML).toBe(html)
      expect(liveCount().all).toBe(before + 1)
      h.destroy()
    } finally {
      create.mockRestore()
      host.remove()
    }
  })

  test('adopts static SSR markup', () => {
    const o: MountOptions = { name: 'Ada', size: 96 }
    const { host, svg } = ssr(o)
    const h = attach(svg, o)
    expect(h.element).toBe(svg)
    h.set({ expression: 'happy' })
    expect(h.element).toBe(svg)
    expect(host.innerHTML).toBe(
      parsed(toSvg('Ada', { size: 96, expression: 'happy' })),
    )
    h.destroy()
    host.remove()
  })

  test('a pruned (non-live) tree throws a descriptive mismatch error', () => {
    const host = document.createElement('div')
    host.innerHTML = toSvg('Ada')
    const svg = host.querySelector('svg') as unknown as SVGSVGElement
    const before = liveCount().all
    expect(() => attach(svg, { name: 'Ada', animate: true })).toThrow(
      /does not match.*live tree/,
    )
    expect(liveCount().all).toBe(before)
  })

  test('a foreign element throws', () => {
    const host = document.createElement('div')
    host.innerHTML = '<svg><circle/></svg>'
    const svg = host.querySelector('svg') as unknown as SVGSVGElement
    expect(() => attach(svg, { name: 'Ada' })).toThrow(/does not match/)
  })
})

describe('isIdentityChange', () => {
  const base: MountOptions = { name: 'Ada', animate: true }
  test('state keys never change identity', () => {
    for (const patch of [
      { expression: 'happy' },
      { activity: 'done' },
      { gaze: [1, 1] },
      { gaze: 'pointer' },
      { ring: { color: '#4f86f7', progress: 0.2, pulse: true } },
      { reaction: 'nod', reactKey: 7 },
    ] as Partial<MountOptions>[])
      expect(isIdentityChange(base, { ...base, ...patch })).toBe(false)
  })
  test('identity keys do', () => {
    for (const patch of [
      { name: 'Linh' },
      { shape: 'cube' },
      { size: 200 },
      { theme: 'clay' },
      { animate: false },
      { version: 1 },
      { style: 'peek@1' },
      { title: false },
      { id: 'x' },
    ] as Partial<MountOptions>[])
      expect(isIdentityChange(base, { ...base, ...patch })).toBe(true)
  })
  test('a no-op override is not a change', () => {
    expect(isIdentityChange(base, { ...base })).toBe(false)
    expect(isIdentityChange(base, { ...base, version: 2 })).toBe(false)
  })
})
