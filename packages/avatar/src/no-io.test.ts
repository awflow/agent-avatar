import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { fakeDom, mount } from './test/dom'

fakeDom()

describe('Live without IntersectionObserver', () => {
  let saved: unknown
  beforeEach(() => {
    saved = globalThis.IntersectionObserver
    delete (globalThis as { IntersectionObserver?: unknown })
      .IntersectionObserver
  })
  afterEach(() => {
    globalThis.IntersectionObserver = saved as typeof IntersectionObserver
  })

  test('mounts, stays visible and animates, then destroys cleanly', () => {
    expect(typeof IntersectionObserver).toBe('undefined')
    const { live, count } = mount('Linh', { activity: 'working' })
    expect(live.visible).toBe(true)
    const n = count()
    for (let i = 0; i < 10; i++) live.step(1 / 60)
    expect(count()).toBe(n)
    expect(() => live.destroy()).not.toThrow()
  })
})
