/*
 * <Avatar> through Vue: server markup against the core's own output,
 * hydration without a mismatch, and the client's one-DOM-owner contract.
 */
import {
  draw,
  Live,
  registerPlugins,
  serialize,
  settle,
  toSvg,
} from '@awflow/avatar/adapter'
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest'
import {
  type App,
  createApp,
  createSSRApp,
  defineComponent,
  h,
  KeepAlive,
  nextTick,
  type Ref,
  ref,
  useId,
  type VNode,
} from 'vue'
import { renderToString } from 'vue/server-renderer'
import { PARITY_CASES, versionOf } from '../../avatar/test/parity-cases'
import { domId } from './avatar'
import {
  Avatar,
  type AvatarExposed,
  AvatarGroup,
  type AvatarProps,
} from './index'

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

/* the id Vue's useId gives the first call in an app */
async function rootId(version?: number): Promise<string> {
  let id = ''
  const Probe = defineComponent({
    setup() {
      id = useId()
      return () => null
    },
  })
  await renderToString(createSSRApp(Probe))
  return domId(id, version)
}

/* the id prefix a client-rendered svg carries: its defs ids minus suffix */
function idOf(svg: Element): string {
  const id = svg.querySelector('[id]')!.id
  return id.slice(0, id.lastIndexOf('-'))
}

/* what an animated avatar paints first: the live tree, serialized */
const liveSvg = (name: string, opts: Parameters<typeof settle>[1]) => {
  const { who, pose, opts: d } = settle(name, opts, true)
  return serialize(draw(who, pose, d))
}

const ssr = (props: Record<string, unknown>) =>
  renderToString(createSSRApp(Avatar, props as any))

const CASES = PARITY_CASES

describe('SSR parity with toSvg', () => {
  for (const { name, opts } of CASES) {
    test(`${name} ${JSON.stringify(opts)}`, async () => {
      const html = await ssr({ name, ...opts })
      expect(tree(html)).toBe(
        tree(toSvg(name, { ...opts, id: await rootId(versionOf(opts)) })),
      )
    })
  }

  test('render is stable across calls', async () => {
    const p = { name: 'Ada', expression: 'happy' }
    expect(await ssr(p)).toBe(await ssr(p))
    const live = { name: 'Ada', animate: true }
    expect(await ssr(live)).toBe(await ssr(live))
  })

  test('carries the accessible name and known geometry', async () => {
    const html = await ssr({ name: 'Linh', neckwear: 'tie', size: 300 })
    expect(html).toContain('aria-label="Linh"')
    expect(html).toContain('M-4 15L-13 63')
  })

  test('version pins and class and style pass through to the svg', async () => {
    const html = await ssr({
      name: 'Linh',
      version: 1,
      class: 'round',
      style: { borderRadius: '50%' },
    })
    const svg = new DOMParser().parseFromString(
      html,
      'image/svg+xml',
    ).documentElement
    expect(svg.getAttribute('class')).toBe('round')
    expect(svg.getAttribute('style')).toBe('border-radius:50%;')
    svg.removeAttribute('class')
    svg.removeAttribute('style')
    const id = await rootId(1)
    expect(id.startsWith('peek-')).toBe(true)
    expect(canon(svg)).toBe(tree(toSvg('Linh', { version: 1, id })))
  })

  test('ids carry the awf- prefix from version 2', async () => {
    expect((await rootId()).startsWith('awf-')).toBe(true)
    const html = await ssr({ name: 'Ada' })
    expect(html).toContain(`id="${await rootId()}-`)
  })

  test('reaction props never change the markup', async () => {
    const a = await ssr({ name: 'Ada' })
    const b = await ssr({ name: 'Ada', reaction: 'nod', reactKey: 3 })
    expect(a).toBe(b)
  })

  test('no class or style attribute when none is given', async () => {
    const html = await ssr({ name: 'Ada' })
    expect(html).not.toContain('class=')
    expect(html).not.toContain('style=')
  })
})

describe('animated SSR emits the live tree', () => {
  for (const { name, opts } of CASES) {
    test(`${name} ${JSON.stringify(opts)}`, async () => {
      const html = await ssr({ name, ...opts, animate: true })
      expect(tree(html)).toBe(
        tree(liveSvg(name, { ...opts, id: await rootId(versionOf(opts)) })),
      )
    })
  }

  test('is deterministic with frames, riso and gaze', async () => {
    for (const frame of ['ink', 'bone', 'paper', 'none'] as const)
      for (const square of [true, false]) {
        const o = {
          frame,
          square,
          eyewear: 'glasses',
          headwear: 'sprout',
          neckwear: 'tie',
          expression: 'surprised',
          gaze: [1, -1],
          riso: true,
          size: 300,
        } as const
        const html = await ssr({ name: 'Linh', ...o, animate: true })
        expect(await ssr({ name: 'Linh', ...o, animate: true })).toBe(html)
        expect(tree(html)).toBe(
          tree(liveSvg('Linh', { ...o, gaze: [1, -1], id: await rootId() })),
        )
      }
  })
})

/* ---------------------------------------------------------------- client */

let apps: { app: App; host: HTMLElement }[] = []
afterEach(() => {
  const done = apps
  apps = []
  // one failing test must not leave its app behind for the next
  for (const { app, host } of done) {
    try {
      app.unmount()
    } catch {}
    host.remove()
  }
  vi.restoreAllMocks()
})

/* mounts a render function over reactive props; render() swaps them */
function show<P>(initial: P, view: (p: P) => VNode) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const state = ref(initial) as Ref<P>
  const app = createApp({ render: () => view(state.value) })
  const warns: unknown[] = []
  app.config.warnHandler = (msg) => warns.push(msg)
  app.mount(host)
  apps.push({ app, host })
  return {
    host,
    warns,
    svg: () => host.querySelector('svg')!,
    async render(next: P) {
      state.value = next
      await nextTick()
    },
  }
}

const avatar = (props: Record<string, unknown>) => h(Avatar, props as any)

/* server markup, then createSSRApp(...).mount over it: no warning at all */
async function hydrate(props: Record<string, unknown>) {
  const host = document.createElement('div')
  host.innerHTML = await ssr(props)
  document.body.appendChild(host)
  const server = host.querySelector('svg')!
  const warn = vi.spyOn(console, 'warn')
  const error = vi.spyOn(console, 'error')
  const warns: unknown[] = []
  const app = createSSRApp(Avatar, props as any)
  app.config.warnHandler = (msg) => warns.push(msg)
  app.mount(host)
  apps.push({ app, host })
  return { host, server, warns, warn, error }
}

describe('hydration', () => {
  for (const { name, opts } of CASES) {
    for (const animate of [false, true]) {
      test(`${name} animate=${animate} hydrates without a mismatch`, async () => {
        const setAttribute = vi.spyOn(Element.prototype, 'setAttribute')
        const { host, server, warns, warn, error } = await hydrate({
          name,
          ...opts,
          animate,
        })
        expect(warns).toEqual([])
        expect(warn).not.toHaveBeenCalled()
        expect(error).not.toHaveBeenCalled()
        // Vue adopted the server's svg, and the first live paint is the
        // server frame: nothing is written over it
        expect(host.querySelector('svg')).toBe(server)
        expect(host.querySelectorAll('svg').length).toBe(1)
        expect(setAttribute).not.toHaveBeenCalled()
      })
    }
  }

  test('with class and style', async () => {
    const { host, server, warns, error } = await hydrate({
      name: 'Ada',
      animate: true,
      class: 'round',
      style: { width: '3rem' },
    })
    expect(warns).toEqual([])
    expect(error).not.toHaveBeenCalled()
    expect(host.querySelector('svg')).toBe(server)
  })
})

describe('client', () => {
  test('animated: an activity change keeps the same svg node', async () => {
    const setActivity = vi.spyOn(Live.prototype, 'setActivity')
    const view = show({ activity: 'idle' } as Record<string, unknown>, (p) =>
      avatar({ name: 'Ada', animate: true, ...p }),
    )
    const svg = view.svg()
    await view.render({ activity: 'thinking' })
    expect(setActivity).toHaveBeenCalledWith('thinking')
    expect(view.svg()).toBe(svg)
    await view.render({
      activity: 'thinking',
      expression: 'happy',
      ring: { color: '#f00', progress: 0.5 },
    })
    expect(view.svg()).toBe(svg)
    expect(view.warns).toEqual([])
  })

  test('an identity change renders a new svg for the new face', async () => {
    const destroy = vi.spyOn(Live.prototype, 'destroy')
    const view = show({ name: 'Ada' }, (p) => avatar({ ...p, animate: true }))
    const svg = view.svg()
    await view.render({ name: 'Linh' })
    const next = view.svg()
    expect(next).not.toBe(svg)
    expect(view.host.querySelectorAll('svg').length).toBe(1)
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  test('static: an identity change draws the new face', async () => {
    const view = show({ name: 'Ada' }, (p) => avatar(p))
    await view.render({ name: 'Linh' })
    const next = view.svg()
    expect(canon(next)).toBe(tree(toSvg('Linh', { id: idOf(next) })))
  })

  test('static: a state change redraws the same svg in place', async () => {
    const view = show({} as Record<string, unknown>, (p) =>
      avatar({ name: 'Ada', ...p }),
    )
    const svg = view.svg()
    await view.render({ expression: 'sad' })
    expect(view.svg()).toBe(svg)
    expect(canon(svg)).toBe(
      tree(toSvg('Ada', { expression: 'sad', id: idOf(svg) })),
    )
    // a later re-render with other props never brings Vue's old children
    const setAttribute = vi.spyOn(Element.prototype, 'setAttribute')
    await view.render({ expression: 'sad', class: 'x' })
    expect(canon(svg)).toContain('class=x')
    expect(setAttribute.mock.contexts.every((el) => el === svg)).toBe(true)
    svg.removeAttribute('class')
    expect(canon(svg)).toBe(
      tree(toSvg('Ada', { expression: 'sad', id: idOf(svg) })),
    )
  })

  test('a reactKey change plays the reaction, never on mount', async () => {
    const react = vi.spyOn(Live.prototype, 'react')
    const view = show({ reactKey: 0 }, (p) =>
      avatar({ name: 'Ada', animate: true, reaction: 'nod', ...p }),
    )
    expect(react).not.toHaveBeenCalled()
    await view.render({ reactKey: 0 })
    expect(react).not.toHaveBeenCalled()
    await view.render({ reactKey: 1 })
    expect(react).toHaveBeenCalledTimes(1)
    expect(react).toHaveBeenCalledWith('nod')
  })

  test('a reactKey change with an identity change plays on the new handle', async () => {
    const react = vi.spyOn(Live.prototype, 'react')
    const r = ref<AvatarExposed | null>(null)
    const view = show({ name: 'Ada', reactKey: 0 }, (p) =>
      h(Avatar, { ref: r, ...p, animate: true, reaction: 'nod' }),
    )
    const before = r.value!.getHandle()
    await view.render({ name: 'Linh', reactKey: 1 })
    const after = r.value!.getHandle()
    expect(after).not.toBe(before)
    expect(react).toHaveBeenCalledTimes(1)
    expect(react.mock.contexts[0] === (after as any).live).toBe(true)
    // an identity change alone plays nothing
    await view.render({ name: 'Grace', reactKey: 1 })
    expect(react).toHaveBeenCalledTimes(1)
  })

  test('the exposed api reaches the live rig', async () => {
    const react = vi.spyOn(Live.prototype, 'react')
    const pulse = vi.spyOn(Live.prototype, 'pulse')
    const voice = vi.spyOn(Live.prototype, 'setVoice')
    const r = ref<AvatarExposed | null>(null)
    show({}, () => h(Avatar, { ref: r, name: 'Ada', animate: true }))
    r.value!.react('wink')
    r.value!.pulse(0.5)
    const fn = () => 0.3
    r.value!.setVoice(fn)
    expect(react).toHaveBeenCalledWith('wink')
    expect(pulse).toHaveBeenCalledWith(0.5)
    expect(voice).toHaveBeenCalledWith(fn)
    expect(r.value!.getHandle()).not.toBeNull()
    expect(r.value!.element).toBe(r.value!.getHandle()!.element)
  })

  test('voice and gaze target survive an identity change', async () => {
    const voice = vi.spyOn(Live.prototype, 'setVoice')
    const lookAt = vi.spyOn(Live.prototype, 'lookAt')
    const r = ref<AvatarExposed | null>(null)
    const view = show({ name: 'Ada' }, (p) =>
      h(Avatar, { ref: r, ...p, animate: true }),
    )
    const fn = () => 0.3
    const spot = document.createElement('div')
    r.value!.setVoice(fn)
    r.value!.lookAt(spot)
    const before = r.value!.getHandle()
    voice.mockClear()
    lookAt.mockClear()
    await view.render({ name: 'Linh' })
    expect(r.value!.getHandle()).not.toBe(before)
    expect(voice).toHaveBeenCalledWith(fn)
    expect(lookAt).toHaveBeenCalledWith(spot)
  })

  test('lookAt accepts another Avatar instance', async () => {
    const lookAt = vi.spyOn(Live.prototype, 'lookAt')
    const a = ref<AvatarExposed | null>(null)
    const b = ref<AvatarExposed | null>(null)
    show({}, () =>
      h('div', [
        h(Avatar, { ref: a, name: 'a', animate: true }),
        h(Avatar, { ref: b, name: 'b', animate: true }),
      ]),
    )
    a.value!.lookAt(b.value)
    expect(lookAt).toHaveBeenLastCalledWith((b.value!.getHandle() as any).live)
  })

  test('class and style land on the svg and survive state changes', async () => {
    const view = show({} as Record<string, unknown>, (p) =>
      avatar({ name: 'Ada', class: 'round', style: { width: '3rem' }, ...p }),
    )
    await view.render({ expression: 'happy' })
    expect(view.svg().getAttribute('class')).toBe('round')
    expect(view.svg().getAttribute('style')).toContain('width: 3rem')
  })

  for (const animate of [false, true]) {
    test(`KeepAlive deactivate and activate after a state change, animate=${animate}`, async () => {
      const bind = vi.spyOn(Live.prototype as any, 'bind')
      const destroy = vi.spyOn(Live.prototype, 'destroy')
      const r = ref<AvatarExposed | null>(null)
      const Other = defineComponent({ render: () => h('p', 'other') })
      type S = { on: boolean; expression: 'happy' | 'sad' }
      const view = show<S>({ on: true, expression: 'happy' }, (s) =>
        h(KeepAlive, null, {
          default: () =>
            s.on
              ? h(Avatar, {
                  ref: r,
                  name: 'Ada',
                  animate,
                  expression: s.expression,
                })
              : h(Other),
        }),
      )
      const svg = view.svg()
      await view.render({ on: true, expression: 'sad' })
      await view.render({ on: false, expression: 'sad' })
      expect(view.host.querySelector('svg')).toBeNull()
      await view.render({ on: true, expression: 'sad' })
      expect(view.svg()).toBe(svg)
      expect(r.value!.getHandle()).not.toBeNull()
      if (!animate)
        expect(canon(svg)).toBe(
          tree(toSvg('Ada', { expression: 'sad', id: idOf(svg) })),
        )
      // a state change while deactivated lands once it is active again
      await view.render({ on: false, expression: 'sad' })
      await view.render({ on: true, expression: 'happy' })
      expect(view.svg()).toBe(svg)
      if (!animate)
        expect(canon(svg)).toBe(
          tree(toSvg('Ada', { expression: 'happy', id: idOf(svg) })),
        )
      // the handle is dropped on deactivate: only the active one lives
      const built = new Set(bind.mock.contexts)
      const dead = new Set(destroy.mock.contexts)
      const alive = [...built].filter((l) => !dead.has(l))
      if (animate) {
        expect(built.size).toBe(3)
        expect(alive).toEqual([(r.value!.getHandle() as any).live])
      } else expect(built.size).toBe(0)
      expect(view.warns).toEqual([])
    })
  }

  test('unmount and re-key leave no live rig behind', async () => {
    const bind = vi.spyOn(Live.prototype as any, 'bind')
    const destroy = vi.spyOn(Live.prototype, 'destroy')
    type S = { on: boolean; name: string }
    const view = show<S>({ on: true, name: 'Ada' }, (s) =>
      s.on ? avatar({ name: s.name, animate: true }) : h('p'),
    )
    await view.render({ on: true, name: 'Linh' })
    await view.render({ on: true, name: 'Grace' })
    await view.render({ on: false, name: 'Grace' })
    const built = new Set(bind.mock.contexts)
    const dead = new Set(destroy.mock.contexts)
    expect(built.size).toBe(3)
    expect([...built].filter((l) => !dead.has(l))).toEqual([])
  })
})

// a plain-object plugin: register the same one on the server and the client
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
  test('a registered plugin hat renders identically on server and client', async () => {
    registerPlugins([testHat])
    const opts = { name: 'Linh', headwear: 'test-hat', size: 200 }
    const html = await ssr(opts)
    const svg = toSvg('Linh', {
      headwear: 'test-hat' as never,
      size: 200,
      id: await rootId(),
    })
    expect(svg).toContain('M110 40L230 40L170 0Z')
    expect(tree(html)).toBe(tree(svg))
    const { host, server, warns, error } = await hydrate(opts)
    expect(warns).toEqual([])
    expect(error).not.toHaveBeenCalled()
    expect(host.querySelector('svg')).toBe(server)
    const view = show({}, () => avatar(opts))
    expect(canon(view.svg())).toBe(
      tree(
        toSvg('Linh', {
          headwear: 'test-hat' as never,
          size: 200,
          id: idOf(view.svg()),
        }),
      ),
    )
  })
})

describe('AvatarGroup', () => {
  const liveOf = (r: Ref<AvatarExposed | null>) =>
    (r.value!.getHandle() as any).live as Live

  /* the last thing each Live was told to look at */
  const lastAim = (spy: MockInstance, live: Live) => {
    const i = spy.mock.contexts.lastIndexOf(live)
    return i < 0 ? undefined : spy.mock.calls[i]![0]
  }

  test('members look at the speaker, the speaker looks ahead', async () => {
    const error = vi.spyOn(console, 'error')
    const lookAt = vi.spyOn(Live.prototype, 'lookAt')
    const a = ref<AvatarExposed | null>(null)
    const b = ref<AvatarExposed | null>(null)
    const c = ref<AvatarExposed | null>(null)
    type S = { speaker: string | undefined; withB: boolean }
    const view = show<S>({ speaker: 'B', withB: true }, (s) =>
      h(
        AvatarGroup,
        { speaker: s.speaker },
        {
          default: () => [
            h(Avatar, { ref: a, name: 'A', animate: true }),
            s.withB ? h(Avatar, { ref: b, name: 'B', animate: true }) : null,
            h(Avatar, { ref: c, name: 'C', animate: true }),
          ],
        },
      ),
    )
    const B = liveOf(b)
    expect(lastAim(lookAt, liveOf(a))).toBe(B)
    expect(lastAim(lookAt, liveOf(c))).toBe(B)
    expect(lastAim(lookAt, B)).toBe(null)
    await view.render({ speaker: 'A', withB: true })
    expect(lastAim(lookAt, B)).toBe(liveOf(a))
    expect(lastAim(lookAt, liveOf(a))).toBe(null)
    // a speaker who is not a member: everyone looks ahead
    await view.render({ speaker: 'Z', withB: true })
    for (const r of [a, b, c]) expect(lastAim(lookAt, liveOf(r))).toBe(null)
    // the speaker leaves while speaking: the others look ahead again
    await view.render({ speaker: 'B', withB: true })
    expect(lastAim(lookAt, liveOf(a))).toBe(B)
    // the group itself clears the others' gaze (spied on the handles: the
    // core's own reset when B's handle dies must not hide a regression)
    const handleA = vi.spyOn(a.value!.getHandle()!, 'lookAt')
    const handleC = vi.spyOn(c.value!.getHandle()!, 'lookAt')
    await view.render({ speaker: 'B', withB: false })
    expect(handleA).toHaveBeenCalledWith(null)
    expect(handleC).toHaveBeenCalledWith(null)
    expect(handleA.mock.lastCall![0]).toBe(null)
    expect(handleC.mock.lastCall![0]).toBe(null)
    expect(b.value).toBe(null)
    expect(lastAim(lookAt, liveOf(a))).toBe(null)
    expect(lastAim(lookAt, liveOf(c))).toBe(null)
    expect(view.warns).toEqual([])
    expect(error).not.toHaveBeenCalled()
  })

  test('renders no wrapper element', () => {
    const view = show({}, () =>
      h(
        AvatarGroup,
        { speaker: 'a' },
        { default: () => [avatar({ name: 'a' })] },
      ),
    )
    const tags = Array.from(view.host.children).map((e) =>
      e.tagName.toLowerCase(),
    )
    expect(tags).toEqual(['svg'])
  })

  test('server-renders its members with no wrapper', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(
            AvatarGroup,
            { speaker: 'a' },
            { default: () => [avatar({ name: 'a' })] },
          ),
      }),
    )
    expect(html.replace(/<!--[^>]*-->/g, '').startsWith('<svg')).toBe(true)
  })
})

// AvatarProps is part of the public surface
const _props: AvatarProps = { name: 'x', gaze: 'pointer', animate: true }
void _props

// the component's props type-check for consumers
const _vnode: VNode = h(Avatar, {
  name: 'x',
  size: 64,
  square: false,
  gaze: [0, 1],
  expression: 'happy',
  ring: { color: '#f00' },
  reactKey: 1,
})
void _vnode
