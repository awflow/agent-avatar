/*
 * Client tests: components compiled for the browser, mounted in jsdom.
 * $state props stand in for a parent passing new values.
 */
import {
  type AvatarHandle,
  Live,
  registerPlugins,
  toSvg,
} from '@awflow/avatar/adapter'
import { flushSync, mount, unmount } from 'svelte'
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest'
import GroupHarness from '../test/group-harness.svelte'
import Avatar from './avatar.svelte'
import { createGroup } from './group'

beforeAll(() => {
  const g = globalThis as any
  g.requestAnimationFrame = () => 1
  g.cancelAnimationFrame = () => {}
  g.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  }
  g.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })
})

const canon = (el: Element): string => {
  const attrs = Array.from(el.attributes)
    .map((a) => `${a.name}=${a.value}`)
    .sort()
    .join(' ')
  const kids = Array.from(el.children).map(canon).join('')
  return `<${el.tagName} ${attrs}>${kids}</${el.tagName}>`
}
const tree = (svg: string) =>
  canon(new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement)

let cleanup: (() => void) | null = null
afterEach(() => {
  cleanup?.()
  cleanup = null
  vi.restoreAllMocks()
})

function show(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Avatar, { target, props: props as any })
  flushSync()
  cleanup = () => {
    unmount(app)
    target.remove()
  }
  return { target, app: app as any }
}

describe('client mount', () => {
  test('animated: an activity change keeps the same svg node', () => {
    const setActivity = vi.spyOn(Live.prototype, 'setActivity')
    const props = $state<Record<string, unknown>>({
      name: 'Ada',
      animate: true,
      activity: 'idle',
    })
    const { target } = show(props)
    const svg = target.querySelector('svg')!
    expect(svg).not.toBeNull()
    props.activity = 'thinking'
    flushSync()
    expect(setActivity).toHaveBeenCalledWith('thinking')
    expect(target.querySelector('svg')).toBe(svg)
    props.expression = 'happy'
    props.ring = { color: '#f00', progress: 0.5 }
    flushSync()
    expect(target.querySelector('svg')).toBe(svg)
  })

  test('an identity change renders a new svg for the new face', () => {
    const props = $state<Record<string, unknown>>({ name: 'Ada' })
    const { target } = show(props)
    const svg = target.querySelector('svg')!
    props.name = 'Linh'
    flushSync()
    const next = target.querySelector('svg')!
    expect(next).not.toBe(svg)
    expect(target.querySelectorAll('svg').length).toBe(1)
    expect(canon(next)).toBe(tree(toSvg('Linh')))
  })

  test('static: a state change redraws the same svg in place', () => {
    const props = $state<Record<string, unknown>>({ name: 'Ada' })
    const { target } = show(props)
    const svg = target.querySelector('svg')!
    props.expression = 'sad'
    flushSync()
    expect(target.querySelector('svg')).toBe(svg)
    expect(canon(svg)).toBe(tree(toSvg('Ada', { expression: 'sad' })))
  })

  test('a reactKey change plays the reaction, never on mount', () => {
    const react = vi.spyOn(Live.prototype, 'react')
    const props = $state<Record<string, unknown>>({
      name: 'Ada',
      animate: true,
      reaction: 'nod',
      reactKey: 0,
    })
    show(props)
    expect(react).not.toHaveBeenCalled()
    props.reactKey = 1
    flushSync()
    expect(react).toHaveBeenCalledTimes(1)
    expect(react).toHaveBeenCalledWith('nod')
  })

  test('the imperative functions reach the live rig', () => {
    const react = vi.spyOn(Live.prototype, 'react')
    const pulse = vi.spyOn(Live.prototype, 'pulse')
    const voice = vi.spyOn(Live.prototype, 'setVoice')
    const { app } = show({ name: 'Ada', animate: true })
    app.react('wave')
    app.pulse(0.5)
    const fn = () => 0.3
    app.setVoice(fn)
    expect(react).toHaveBeenCalledWith('wave')
    expect(pulse).toHaveBeenCalledWith(0.5)
    expect(voice).toHaveBeenCalledWith(fn)
    expect(app.getHandle()).not.toBeNull()
  })

  test('class and style land on the svg and survive state changes', () => {
    const props = $state<Record<string, unknown>>({
      name: 'Ada',
      class: 'round',
      style: 'width: 3rem',
    })
    const { target } = show(props)
    props.expression = 'happy'
    flushSync()
    const svg = target.querySelector('svg')!
    expect(svg.getAttribute('class')).toBe('round')
    expect(svg.getAttribute('style')).toContain('width: 3rem')
  })
})

// the same plain-object plugin the SSR test registers
const testHat = {
  kind: 'accessory' as const,
  slot: 'headwear' as const,
  name: 'test-hat',
  draw: (c: { ink: { body: string } }) => [
    {
      tag: 'path',
      key: 'brim',
      attrs: { d: 'M110 40L230 40L170 0Z', fill: c.ink.body },
      children: [],
    },
  ],
}

describe('plugins', () => {
  test('a registered plugin hat renders on the client as on the server', () => {
    registerPlugins([testHat])
    const opts = { headwear: 'test-hat', size: 200 }
    const { target } = show({ name: 'Linh', ...opts })
    const svg = toSvg('Linh', opts as never)
    expect(svg).toContain('M110 40L230 40L170 0Z')
    expect(canon(target.querySelector('svg')!)).toBe(tree(svg))
  })
})

describe('group', () => {
  const fake = () => ({ lookAt: vi.fn() }) as unknown as AvatarHandle

  test('members look at the speaker, the speaker looks ahead', () => {
    const g = createGroup()
    const a = fake()
    const b = fake()
    const c = fake()
    g.registerMember('a', a)
    g.registerMember('b', b)
    const off = g.registerMember('c', c)
    g.setSpeaker('b')
    expect(a.lookAt).toHaveBeenLastCalledWith(b)
    expect(c.lookAt).toHaveBeenLastCalledWith(b)
    expect(b.lookAt).toHaveBeenLastCalledWith(null)
    off()
    g.setSpeaker('nobody')
    expect(a.lookAt).toHaveBeenLastCalledWith(null)
    expect(b.lookAt).toHaveBeenLastCalledWith(null)
    // an unregistered member is left alone
    expect(c.lookAt).toHaveBeenLastCalledWith(b)
  })

  test('a member joining later is aimed right away', () => {
    const g = createGroup()
    const a = fake()
    const b = fake()
    g.setSpeaker('a')
    g.registerMember('a', a)
    g.registerMember('b', b)
    expect(b.lookAt).toHaveBeenLastCalledWith(a)
    expect(a.lookAt).toHaveBeenLastCalledWith(null)
  })
})

describe('AvatarGroup component', () => {
  const liveOf = (inst: any) => (inst.getHandle() as any).live as Live

  /* the last thing each Live was told to look at */
  const lastAim = (spy: MockInstance, live: Live) => {
    const i = spy.mock.contexts.lastIndexOf(live)
    return i < 0 ? undefined : spy.mock.calls[i]![0]
  }

  test('members look at the speaker, the speaker looks ahead', () => {
    const error = vi.spyOn(console, 'error')
    const lookAt = vi.spyOn(Live.prototype, 'lookAt')
    const refs: Record<string, any> = {}
    const state = $state<{ speaker?: string; withB: boolean }>({
      speaker: 'B',
      withB: true,
    })
    // refs stays a plain object: bind:this writes straight into it
    const props = {
      get speaker() {
        return state.speaker
      },
      get withB() {
        return state.withB
      },
      refs,
    }
    const target = document.createElement('div')
    document.body.appendChild(target)
    const app = mount(GroupHarness, { target, props })
    flushSync()
    cleanup = () => {
      unmount(app)
      target.remove()
    }
    const B = liveOf(refs.B)
    expect(lastAim(lookAt, liveOf(refs.A))).toBe(B)
    expect(lastAim(lookAt, liveOf(refs.C))).toBe(B)
    expect(lastAim(lookAt, B)).toBe(null)
    state.speaker = 'A'
    flushSync()
    expect(lastAim(lookAt, B)).toBe(liveOf(refs.A))
    expect(lastAim(lookAt, liveOf(refs.A))).toBe(null)
    // a speaker who is not a member: everyone looks ahead
    state.speaker = 'Z'
    flushSync()
    for (const k of ['A', 'B', 'C'])
      expect(lastAim(lookAt, liveOf(refs[k]))).toBe(null)
    // the speaker leaves while speaking: the others look ahead again
    state.speaker = 'B'
    flushSync()
    expect(lastAim(lookAt, liveOf(refs.A))).toBe(B)
    state.withB = false
    flushSync()
    expect(refs.B).toBe(null)
    expect(lastAim(lookAt, liveOf(refs.A))).toBe(null)
    expect(lastAim(lookAt, liveOf(refs.C))).toBe(null)
    expect(target.querySelectorAll('svg').length).toBe(2)
    expect(error).not.toHaveBeenCalled()
  })
})
