/*
 * <Avatar> in the browser: hydration of the exact server markup without a
 * warning, the one-DOM-owner contract, the ref, reactions and groups.
 */
import { Live, registerPlugins } from '@awflow/avatar/adapter'
import { type Accessor, createSignal, type Setter, Show } from 'solid-js'
import { hydrate, render } from 'solid-js/web'
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest'
import { Avatar, AvatarGroup, type AvatarProps, type AvatarRef } from './index'
import {
  CASES,
  liveSvg,
  rootId,
  span,
  testHat,
  toSvg,
  versionOf,
} from './test/markup'

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

/* the id prefix a client-rendered svg carries: its defs ids minus suffix */
function idOf(svg: Element): string {
  const id = svg.querySelector('[id]')!.id
  return id.slice(0, id.lastIndexOf('-'))
}

let disposers: { dispose: () => void; host: HTMLElement }[] = []
afterEach(() => {
  const done = disposers
  disposers = []
  // one failing test must not leave its root behind for the next
  for (const { dispose, host } of done) {
    try {
      dispose()
    } catch {}
    host.remove()
  }
  vi.restoreAllMocks()
})

function host(html = ''): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

/* renders a view over a signal; set() swaps the props */
function show<P>(initial: P, view: (p: Accessor<P>) => unknown) {
  const el = host()
  const [state, set] = createSignal(initial)
  const dispose = render(() => view(state) as any, el)
  disposers.push({ dispose, host: el })
  return {
    host: el,
    svg: () => el.querySelector('svg')!,
    set: set as Setter<P>,
    dispose,
  }
}

/* the exact server markup, then hydrate() over it */
function hydrateOver(props: AvatarProps, html: string) {
  ;(globalThis as any)._$HY = { events: [], completed: new WeakSet(), r: {} }
  const el = host(html)
  const server = el.querySelector('svg')!
  const warn = vi.spyOn(console, 'warn')
  const error = vi.spyOn(console, 'error')
  let ref: AvatarRef | undefined
  const dispose = hydrate(
    () => (
      <Avatar
        {...props}
        ref={(r) => {
          ref = r
        }}
      />
    ),
    el,
  )
  disposers.push({ dispose, host: el })
  return { host: el, server, warn, error, ref: () => ref! }
}

describe('hydration', () => {
  for (const { name, opts } of CASES) {
    for (const animate of [false, true]) {
      test(`${name} animate=${animate} adopts the server svg`, () => {
        const setAttribute = vi.spyOn(Element.prototype, 'setAttribute')
        const svg = animate
          ? liveSvg(name, { ...opts, id: rootId(versionOf(opts)) })
          : toSvg(name, { ...opts, id: rootId(versionOf(opts)) })
        const props = { name, ...opts, animate }
        const bind = vi.spyOn(Live.prototype as any, 'bind')
        const { host, server, warn, error, ref } = hydrateOver(props, span(svg))
        expect(warn).not.toHaveBeenCalled()
        expect(error).not.toHaveBeenCalled()
        // Solid adopted the server's svg, and the first live paint is the
        // server frame: nothing is written over it
        expect(host.querySelector('svg')).toBe(server)
        expect(host.querySelectorAll('svg').length).toBe(1)
        expect(setAttribute).not.toHaveBeenCalled()
        expect(ref().getHandle()).not.toBeNull()
        expect(ref().element).toBe(server)
        expect(new Set(bind.mock.contexts).size).toBe(animate ? 1 : 0)
      })
    }
  }

  test('with class and style', () => {
    const setAttribute = vi.spyOn(Element.prototype, 'setAttribute')
    const svg = liveSvg('Ada', { id: rootId() }).replace(
      /^<svg([^>]*)>/,
      '<svg$1 class="round" style="width:3rem">',
    )
    const { host, server, error } = hydrateOver(
      { name: 'Ada', animate: true, class: 'round', style: { width: '3rem' } },
      span(svg),
    )
    expect(error).not.toHaveBeenCalled()
    expect(host.querySelector('svg')).toBe(server)
    expect(setAttribute).not.toHaveBeenCalled()
  })

  test('a mismatching server svg throws a descriptive error', () => {
    const svg = liveSvg('Ada', { id: rootId(), headwear: 'sprout' })
    expect(() =>
      hydrateOver({ name: 'Ada', animate: true }, span(svg)),
    ).toThrow()
  })
})

describe('client', () => {
  test('client-only render draws the same tree as toSvg', () => {
    const view = show({}, () => <Avatar name='Ada' expression='happy' />)
    const svg = view.svg()
    expect(svg.parentElement!.tagName).toBe('SPAN')
    expect(svg.parentElement!.getAttribute('style')).toBe('display:contents')
    expect(canon(svg)).toBe(
      tree(toSvg('Ada', { expression: 'happy', id: idOf(svg) })),
    )
    expect(idOf(svg).startsWith('awf-')).toBe(true)
  })

  test('animated: an activity change keeps the same svg node', () => {
    const setActivity = vi.spyOn(Live.prototype, 'setActivity')
    const view = show<Partial<AvatarProps>>({ activity: 'idle' }, (p) => (
      <Avatar name='Ada' animate {...p()} />
    ))
    const svg = view.svg()
    view.set({ activity: 'thinking' })
    expect(setActivity).toHaveBeenCalledWith('thinking')
    expect(view.svg()).toBe(svg)
    view.set({
      activity: 'thinking',
      expression: 'happy',
      ring: { color: '#f00', progress: 0.5 },
    })
    expect(view.svg()).toBe(svg)
  })

  test('an identity change renders a new svg for the new face', () => {
    const destroy = vi.spyOn(Live.prototype, 'destroy')
    const view = show({ name: 'Ada' }, (p) => <Avatar {...p()} animate />)
    const svg = view.svg()
    view.set({ name: 'Linh' })
    const next = view.svg()
    expect(next).not.toBe(svg)
    expect(view.host.querySelectorAll('svg').length).toBe(1)
    expect(next.parentElement!.tagName).toBe('SPAN')
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  test('static: an identity change draws the new face', () => {
    const view = show({ name: 'Ada' }, (p) => <Avatar {...p()} />)
    view.set({ name: 'Linh' })
    const next = view.svg()
    expect(canon(next)).toBe(tree(toSvg('Linh', { id: idOf(next) })))
  })

  test('static: a state change redraws the same svg in place', () => {
    const view = show<Partial<AvatarProps>>({}, (p) => (
      <Avatar name='Ada' {...p()} />
    ))
    const svg = view.svg()
    view.set({ expression: 'sad' })
    expect(view.svg()).toBe(svg)
    expect(canon(svg)).toBe(
      tree(toSvg('Ada', { expression: 'sad', id: idOf(svg) })),
    )
  })

  test('a reactKey change plays the reaction, never on mount', () => {
    const react = vi.spyOn(Live.prototype, 'react')
    const view = show({ reactKey: 0 }, (p) => (
      <Avatar name='Ada' animate reaction='nod' {...p()} />
    ))
    expect(react).not.toHaveBeenCalled()
    view.set({ reactKey: 0 })
    expect(react).not.toHaveBeenCalled()
    view.set({ reactKey: 1 })
    expect(react).toHaveBeenCalledTimes(1)
    expect(react).toHaveBeenCalledWith('nod')
  })

  test('a reactKey change with an identity change plays on the new svg', () => {
    const react = vi.spyOn(Live.prototype, 'react')
    let r!: AvatarRef
    const view = show({ name: 'Ada', reactKey: 0 }, (p) => (
      <Avatar ref={r} animate reaction='nod' {...p()} />
    ))
    const before = r.element
    // one owner, the handle: it rebuilds, then plays on the new Live
    view.set({ name: 'Linh', reactKey: 1 })
    expect(r.element).not.toBe(before)
    expect(react).toHaveBeenCalledTimes(1)
    expect(react.mock.contexts[0] === (r.getHandle() as any).live).toBe(true)
    // an identity change alone plays nothing
    view.set({ name: 'Grace', reactKey: 1 })
    expect(react).toHaveBeenCalledTimes(1)
  })

  test('the ref reaches the live rig', () => {
    const react = vi.spyOn(Live.prototype, 'react')
    const pulse = vi.spyOn(Live.prototype, 'pulse')
    const voice = vi.spyOn(Live.prototype, 'setVoice')
    let r!: AvatarRef
    show({}, () => <Avatar ref={r} name='Ada' animate />)
    r.react('wink')
    r.pulse(0.5)
    const fn = () => 0.3
    r.setVoice(fn)
    expect(react).toHaveBeenCalledWith('wink')
    expect(pulse).toHaveBeenCalledWith(0.5)
    expect(voice).toHaveBeenCalledWith(fn)
    expect(r.getHandle()).not.toBeNull()
    expect(r.element).toBe(r.getHandle()!.element)
  })

  test('the ref is stable and voice and gaze survive an identity change', () => {
    const voice = vi.spyOn(Live.prototype, 'setVoice')
    const lookAt = vi.spyOn(Live.prototype, 'lookAt')
    const refs: AvatarRef[] = []
    const view = show({ name: 'Ada' }, (p) => (
      <Avatar ref={(r) => refs.push(r)} {...p()} animate />
    ))
    const r = refs[0]!
    const fn = () => 0.3
    const spot = document.createElement('div')
    r.setVoice(fn)
    r.lookAt(spot)
    const before = r.element
    voice.mockClear()
    lookAt.mockClear()
    view.set({ name: 'Linh' })
    expect(refs.length).toBe(1)
    expect(r.element).not.toBe(before)
    expect(r.element).toBe(view.svg())
    expect(voice).toHaveBeenCalledWith(fn)
    expect(lookAt).toHaveBeenCalledWith(spot)
  })

  test('lookAt accepts another Avatar ref', () => {
    const lookAt = vi.spyOn(Live.prototype, 'lookAt')
    let a!: AvatarRef
    let b!: AvatarRef
    show({}, () => (
      <div>
        <Avatar ref={a} name='a' animate />
        <Avatar ref={b} name='b' animate />
      </div>
    ))
    a.lookAt(b)
    expect(lookAt).toHaveBeenLastCalledWith((b.getHandle() as any).live)
  })

  test('class and style land on the svg and follow changes', () => {
    const view = show<Partial<AvatarProps>>(
      { class: 'round', style: { width: '3rem' } },
      (p) => <Avatar name='Ada' animate {...p()} />,
    )
    expect(view.svg().getAttribute('class')).toBe('round')
    expect(view.svg().getAttribute('style')).toBe('width:3rem')
    view.set({ class: 'square', style: 'height:2rem', expression: 'happy' })
    expect(view.svg().getAttribute('class')).toBe('square')
    expect(view.svg().getAttribute('style')).toBe('height:2rem')
    view.set({ class: 'square', style: 'height:2rem', name: 'Linh' } as any)
    expect(view.svg().getAttribute('class')).toBe('square')
    view.set({})
    expect(view.svg().hasAttribute('class')).toBe(false)
    expect(view.svg().hasAttribute('style')).toBe(false)
  })

  test('unmount and identity changes leave no live rig behind', () => {
    const bind = vi.spyOn(Live.prototype as any, 'bind')
    const destroy = vi.spyOn(Live.prototype, 'destroy')
    const view = show({ on: true, name: 'Ada' }, (s) => (
      <Show when={s().on}>
        <Avatar name={s().name} animate />
      </Show>
    ))
    view.set({ on: true, name: 'Linh' })
    view.set({ on: true, name: 'Grace' })
    view.set({ on: false, name: 'Grace' })
    const built = new Set(bind.mock.contexts)
    const dead = new Set(destroy.mock.contexts)
    expect(built.size).toBe(3)
    expect([...built].filter((l) => !dead.has(l))).toEqual([])
    expect(view.host.querySelector('svg')).toBeNull()
  })
})

describe('plugins', () => {
  test('a registered plugin hat hydrates and renders like toSvg', () => {
    registerPlugins([testHat])
    const props = { name: 'Linh', headwear: 'test-hat' as never, size: 200 }
    const svg = toSvg('Linh', { ...props, id: rootId() })
    expect(svg).toContain('M110 40L230 40L170 0Z')
    const { host, server, warn, error } = hydrateOver(props, span(svg))
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    expect(host.querySelector('svg')).toBe(server)
    const view = show({}, () => <Avatar {...props} />)
    expect(canon(view.svg())).toBe(
      tree(toSvg('Linh', { ...props, id: idOf(view.svg()) })),
    )
  })
})

describe('AvatarGroup', () => {
  const liveOf = (r: AvatarRef) => (r.getHandle() as any).live as Live

  /* the last thing each Live was told to look at */
  const lastAim = (spy: MockInstance, live: Live) => {
    const i = spy.mock.contexts.lastIndexOf(live)
    return i < 0 ? undefined : spy.mock.calls[i]![0]
  }

  test('members look at the speaker, the speaker looks ahead', () => {
    const error = vi.spyOn(console, 'error')
    const lookAt = vi.spyOn(Live.prototype, 'lookAt')
    let a!: AvatarRef
    let b!: AvatarRef
    let c!: AvatarRef
    // B's presence is its own signal: removing B must not re-run the
    // group's speaker effect, which would re-aim everyone and hide a
    // regression in the group's own clearing
    const [withB, setWithB] = createSignal(true)
    type S = { speaker: string | undefined }
    const view = show<S>({ speaker: 'B' }, (s) => (
      <AvatarGroup speaker={s().speaker}>
        <Avatar ref={a} name='A' animate />
        <Show when={withB()}>
          <Avatar ref={b} name='B' animate />
        </Show>
        <Avatar ref={c} name='C' animate />
      </AvatarGroup>
    ))
    const B = liveOf(b)
    expect(lastAim(lookAt, liveOf(a))).toBe(B)
    expect(lastAim(lookAt, liveOf(c))).toBe(B)
    expect(lastAim(lookAt, B)).toBe(null)
    view.set({ speaker: 'A' })
    expect(lastAim(lookAt, B)).toBe(liveOf(a))
    expect(lastAim(lookAt, liveOf(a))).toBe(null)
    // a speaker who is not a member: everyone looks ahead
    view.set({ speaker: 'Z' })
    for (const r of [a, b, c]) expect(lastAim(lookAt, liveOf(r))).toBe(null)
    // the speaker leaves while speaking: the others look ahead again
    view.set({ speaker: 'B' })
    expect(lastAim(lookAt, liveOf(a))).toBe(B)
    // the group itself clears the others' gaze (spied on the handles: the
    // core's own reset when B's handle dies must not hide a regression)
    const handleA = vi.spyOn(a.getHandle()!, 'lookAt')
    const handleC = vi.spyOn(c.getHandle()!, 'lookAt')
    setWithB(false)
    expect(handleA).toHaveBeenCalledWith(null)
    expect(handleC).toHaveBeenCalledWith(null)
    expect(handleA.mock.lastCall![0]).toBe(null)
    expect(handleC.mock.lastCall![0]).toBe(null)
    expect(b.getHandle()).toBe(null)
    expect(lastAim(lookAt, liveOf(a))).toBe(null)
    expect(lastAim(lookAt, liveOf(c))).toBe(null)
    expect(error).not.toHaveBeenCalled()
  })

  test('a renamed member is matched under its new name', () => {
    const lookAt = vi.spyOn(Live.prototype, 'lookAt')
    let a!: AvatarRef
    let b!: AvatarRef
    const view = show({ name: 'b' }, (s) => (
      <AvatarGroup speaker='z'>
        <Avatar ref={a} name='a' animate />
        <Avatar ref={b} name={s().name} animate />
      </AvatarGroup>
    ))
    expect(lastAim(lookAt, liveOf(a))).toBe(null)
    view.set({ name: 'z' })
    expect(lastAim(lookAt, liveOf(a))).toBe(liveOf(b))
  })

  test('renders no wrapper element', () => {
    const view = show({}, () => (
      <AvatarGroup speaker='a'>
        <Avatar name='a' />
      </AvatarGroup>
    ))
    const tags = Array.from(view.host.children).map((e) =>
      e.tagName.toLowerCase(),
    )
    expect(tags).toEqual(['span'])
  })
})

describe('dist', () => {
  test('the published browser build mounts and hands out a ref', async () => {
    const dist = await import('../dist/index.js')
    const react = vi.spyOn(Live.prototype, 'react')
    let r!: AvatarRef
    const view = show({}, () => <dist.Avatar ref={r} name='Ada' animate />)
    expect(r.getHandle()).not.toBeNull()
    r.react('wink')
    expect(react).toHaveBeenCalledWith('wink')
    expect(view.svg()).toBe(r.element)
  })
})
