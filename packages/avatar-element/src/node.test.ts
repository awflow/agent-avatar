// @vitest-environment node
import { describe, expect, it } from 'vitest'

describe('server import', () => {
  it('imports in Node without a DOM and defines nothing', async () => {
    expect(typeof HTMLElement).toBe('undefined')
    const mod = await import('./index')
    expect(typeof mod.defineAvatarElements).toBe('function')
    expect(() => mod.defineAvatarElements()).not.toThrow()
  })
})
