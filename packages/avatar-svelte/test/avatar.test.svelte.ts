/*
 * Client tests: components compiled for the browser, mounted in jsdom.
 * $state props stand in for a parent passing new values.
 */
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import {
  type AvatarHandle,
  Live,
  registerPlugins,
  toSvg,
} from '@awflow/avatar/adapter'
import { flushSync, hydrate, mount, unmount } from 'svelte'
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest'
import { PARITY_CASES } from '../../avatar/test/parity-cases'
import Avatar from '../src/avatar.svelte'
import { createGroup } from '../src/group'
import GroupHarness from './group-harness.svelte'

/* the id prefix a client-rendered svg carries: its defs ids minus suffix */
function idOf(svg: Element): string {
  const id = svg.querySelector('[id]')!.id
  return id.slice(0, id.lastIndexOf('-'))
}

/* every url(#id) an svg refers to */
const refs = (svg: Element): string[] =>
  Array.from(svg.querySelectorAll('*')).flatMap((el) =>
    Array.from(el.attributes).flatMap((a) =>
      Array.from(a.value.matchAll(/url\(#([^)]+)\)/g), (m) => m[1]!),
    ),
  )

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

let cleanups: (() => void)[] = []
afterEach(() => {
  for (const c of cleanups) c()
  cleanups = []
  vi.restoreAllMocks()
})
/* kept for the group test below, which mounts its own harness */
let cleanup: (() => void) | null = null
afterEach(() => {
  cleanup?.()
  cleanup = null
})

function show(props: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(Avatar, { target, props: props as any })
  flushSync()
  cleanups.push(() => {
    unmount(app)
    target.remove()
  })
  return { target, app: app as any }
}

/* server markup from a separate Bun process (test/server-render.ts) */
// vitest runs from the package directory (its config's root)
function serverRender(list: Record<string, unknown>[]): string[] {
  const out = execFileSync(
    'bun',
    [
      '--conditions=awflow-src',
      join(process.cwd(), 'test/server-render.ts'),
      JSON.stringify(list),
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  )
  return (JSON.parse(out) as { body: string }[]).map((r) => r.body)
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
    expect(canon(next)).toBe(tree(toSvg('Linh', { id: idOf(next) })))
  })

  test('static: a state change redraws the same svg in place', () => {
    const props = $state<Record<string, unknown>>({ name: 'Ada' })
    const { target } = show(props)
    const svg = target.querySelector('svg')!
    props.expression = 'sad'
    flushSync()
    expect(target.querySelector('svg')).toBe(svg)
    expect(canon(svg)).toBe(
      tree(toSvg('Ada', { expression: 'sad', id: idOf(svg) })),
    )
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

describe('per-instance ids', () => {
  test('two identical animated avatars never share an id or a url(#…)', () => {
    const a = show({ name: 'Ada', animate: true }).target.querySelector('svg')!
    const b = show({ name: 'Ada', animate: true }).target.querySelector('svg')!
    const ids = (svg: Element) =>
      Array.from(svg.querySelectorAll('[id]'), (el) => el.id)
    expect(ids(a).length).toBeGreaterThan(0)
    expect(idOf(a)).not.toBe(idOf(b))
    expect(ids(a).filter((id) => ids(b).includes(id))).toEqual([])
    for (const svg of [a, b]) {
      const own = ids(svg)
      const other = svg === a ? ids(b) : ids(a)
      expect(refs(svg).length).toBeGreaterThan(0)
      for (const r of refs(svg)) {
        expect(own).toContain(r)
        expect(other).not.toContain(r)
        // the page resolves the reference inside this svg
        expect(svg.contains(document.getElementById(r))).toBe(true)
      }
    }
  })

  test('a version 1 avatar keeps the peek- prefix', () => {
    const svg = show({ name: 'Ada', version: 1 }).target.querySelector('svg')!
    expect(idOf(svg)).toMatch(/^peek-/)
  })
})

describe('imperative surface', () => {
  test('lookAt takes another Avatar instance, re-resolved on a new svg', () => {
    const lookAt = vi.spyOn(Live.prototype, 'lookAt')
    const props = $state<Record<string, unknown>>({
      name: 'Ada',
      animate: true,
    })
    const one = show(props).app
    const two = show({ name: 'Linh', animate: true }).app
    one.lookAt(two)
    const liveOf = (inst: any) => (inst.getHandle() as any).live as Live
    /* whether a Live was last told to look at `at` (booleans: a failing
     * diff of two Lives would walk the whole page) */
    const aims = (live: Live, at: Live | null) => {
      const i = lookAt.mock.contexts.lastIndexOf(live)
      return i >= 0 && lookAt.mock.calls[i]![0] === at
    }
    expect(aims(liveOf(one), liveOf(two))).toBe(true)
    // this avatar gets a new svg: its new handle resolves the instance again
    props.name = 'Grace'
    flushSync()
    expect(aims(liveOf(one), liveOf(two))).toBe(true)
    one.lookAt(null)
    expect(aims(liveOf(one), null)).toBe(true)
  })

  test('lookAt takes a handle and an element too', () => {
    const lookAt = vi.spyOn(Live.prototype, 'lookAt')
    const one = show({ name: 'Ada', animate: true }).app
    const two = show({ name: 'Linh', animate: true }).app
    const spot = document.createElement('div')
    one.lookAt(spot)
    expect(lookAt).toHaveBeenLastCalledWith(spot)
    one.lookAt(two.getHandle())
    expect(lookAt.mock.lastCall![0] === (two.getHandle() as any).live).toBe(
      true,
    )
  })

  test('getElement returns the svg, a new one after an identity change', () => {
    const props = $state<Record<string, unknown>>({ name: 'Ada' })
    const { target, app } = show(props)
    expect(app.getElement()).toBe(target.querySelector('svg'))
    props.name = 'Linh'
    flushSync()
    expect(app.getElement()).toBe(target.querySelector('svg'))
    expect(app.getElement()).toBe(app.getHandle().element)
  })

  test('a reactKey change with an identity change plays on the new handle', () => {
    const react = vi.spyOn(Live.prototype, 'react')
    const props = $state<Record<string, unknown>>({
      name: 'Ada',
      animate: true,
      reaction: 'nod',
      reactKey: 0,
    })
    const { app } = show(props)
    const before = app.getHandle()
    props.name = 'Linh'
    props.reactKey = 1
    flushSync()
    const after = app.getHandle()
    expect(after).not.toBe(before)
    expect(react).toHaveBeenCalledTimes(1)
    expect(react.mock.contexts[0]).toBe((after as any).live)
    // an identity change alone plays nothing
    props.name = 'Grace'
    flushSync()
    expect(react).toHaveBeenCalledTimes(1)
  })
})

describe('hydration', () => {
  const cases = PARITY_CASES.flatMap(({ name, opts }) =>
    [false, true].map((animate) => ({ name, ...opts, animate })),
  )
  let bodies: string[] = []
  beforeAll(() => {
    bodies = serverRender([...cases, { name: 'Ada', class: 'round' }])
  }, 60_000)

  function hydrateAt(body: string, props: Record<string, unknown>) {
    const host = document.createElement('div')
    host.innerHTML = body
    document.body.appendChild(host)
    const server = host.querySelector('svg')!
    const markup = server.outerHTML
    const warn = vi.spyOn(console, 'warn')
    const error = vi.spyOn(console, 'error')
    const setAttribute = vi.spyOn(Element.prototype, 'setAttribute')
    const app = hydrate(Avatar, { target: host, props: props as any })
    flushSync()
    const writes = setAttribute.mock.calls.length
    setAttribute.mockRestore()
    cleanups.push(() => {
      unmount(app)
      host.remove()
    })
    return { host, server, markup, warn, error, writes, app: app as any }
  }

  cases.forEach((props, i) => {
    test(`${props.name} animate=${props.animate} adopts the server svg`, () => {
      const { host, server, markup, warn, error, writes } = hydrateAt(
        bodies[i]!,
        props,
      )
      expect(warn).not.toHaveBeenCalled()
      expect(error).not.toHaveBeenCalled()
      expect(host.querySelectorAll('svg').length).toBe(1)
      expect(host.querySelector('svg')).toBe(server)
      // the first paint is the server's: nothing is written over it
      expect(writes).toBe(0)
      expect(server.outerHTML).toBe(markup)
    })
  })

  test('static, then a state change: one svg, redrawn, then a clean unmount', () => {
    const props = $state<Record<string, unknown>>({
      name: 'Ada',
      class: 'round',
    })
    const destroy = vi.spyOn(Live.prototype, 'destroy')
    const { host, server, warn, error, app } = hydrateAt(
      bodies[cases.length]!,
      props,
    )
    props.expression = 'sad'
    flushSync()
    expect(host.querySelectorAll('svg').length).toBe(1)
    expect(host.querySelector('svg')).toBe(server)
    expect(server.getAttribute('class')).toBe('round')
    server.removeAttribute('class')
    expect(canon(server)).toBe(
      tree(toSvg('Ada', { expression: 'sad', id: idOf(server) })),
    )
    server.setAttribute('class', 'round')
    // an identity change after the core redrew: Svelte swaps the svg cleanly
    props.name = 'Linh'
    flushSync()
    expect(host.querySelectorAll('svg').length).toBe(1)
    const next = host.querySelector('svg')!
    expect(next).not.toBe(server)
    expect(app.getElement()).toBe(next)
    // and unmounts without leaving an svg behind
    const c = cleanups.pop()!
    c()
    expect(host.querySelector('svg')).toBeNull()
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    void destroy
  })

  test('animated: unmount after hydration stops the rig', () => {
    const destroy = vi.spyOn(Live.prototype, 'destroy')
    const i = cases.findIndex((c) => c.animate)
    const { host, error } = hydrateAt(bodies[i]!, cases[i]!)
    cleanups.pop()!()
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(host.querySelector('svg')).toBeNull()
    expect(error).not.toHaveBeenCalled()
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
    const el = target.querySelector('svg')!
    const svg = toSvg('Linh', { ...opts, id: idOf(el) } as never)
    expect(svg).toContain('M110 40L230 40L170 0Z')
    expect(canon(el)).toBe(tree(svg))
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
    // the group itself clears the others' gaze (spied on the handles: the
    // core's own reset when B's handle dies must not hide a regression)
    const handleA = vi.spyOn(refs.A.getHandle() as AvatarHandle, 'lookAt')
    const handleC = vi.spyOn(refs.C.getHandle() as AvatarHandle, 'lookAt')
    state.withB = false
    flushSync()
    expect(handleA).toHaveBeenCalledWith(null)
    expect(handleC).toHaveBeenCalledWith(null)
    expect(handleA.mock.lastCall![0]).toBe(null)
    expect(handleC.mock.lastCall![0]).toBe(null)
    expect(refs.B).toBe(null)
    expect(lastAim(lookAt, liveOf(refs.A))).toBe(null)
    expect(lastAim(lookAt, liveOf(refs.C))).toBe(null)
    expect(target.querySelectorAll('svg').length).toBe(2)
    expect(error).not.toHaveBeenCalled()
  })
})
