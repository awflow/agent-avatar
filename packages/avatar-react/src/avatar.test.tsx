/*
 * <Avatar> through React: server markup against the core's own output,
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
import { act, createRef, type ReactNode, StrictMode, useId } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest'
import { domId } from './avatar'
import { Avatar, AvatarGroup, type AvatarProps, type AvatarRef } from './index'

beforeAll(() => {
  const g = globalThis as any
  g.IS_REACT_ACT_ENVIRONMENT = true
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

/* the id React's useId gives the first hook of a lone root component */
function rootId(version?: number): string {
  let id = ''
  function Probe() {
    id = useId()
    return null
  }
  renderToString(<Probe />)
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

const CASES = [
  { name: 'Ada Lovelace', opts: { expression: 'happy' as const } },
  {
    name: 'Linh',
    opts: { expression: 'sad' as const, frame: 'bone' as const },
  },
  {
    name: 'Doan Labs',
    opts: {
      expression: 'surprised' as const,
      eyewear: 'glasses' as const,
      headwear: 'sprout' as const,
      neckwear: 'tie' as const,
      size: 300,
    },
  },
  { name: '東京', opts: { expression: 'curious' as const, square: false } },
  {
    name: 'Grace Hopper',
    opts: {
      activity: 'thinking' as const,
      theme: 'bold',
      headwear: 'antenna' as const,
      framing: 'full' as const,
    },
  },
]

describe('SSR parity with toSvg', () => {
  for (const { name, opts } of CASES) {
    test(`${name} ${JSON.stringify(opts)}`, () => {
      const html = renderToString(<Avatar name={name} {...opts} />)
      expect(tree(html)).toBe(tree(toSvg(name, { ...opts, id: rootId() })))
    })
  }

  test('render is stable across calls', () => {
    const el = <Avatar name='Ada' expression='happy' />
    expect(renderToString(el)).toBe(renderToString(el))
    const live = <Avatar name='Ada' animate />
    expect(renderToString(live)).toBe(renderToString(live))
  })

  test('carries the accessible name and known geometry', () => {
    const html = renderToString(
      <Avatar name='Linh' neckwear='tie' size={300} />,
    )
    expect(html).toContain('aria-label="Linh"')
    expect(html).toContain('M-4 15L-13 63')
  })

  test('version pins and className and style pass through to the svg', () => {
    const html = renderToString(
      <Avatar
        name='Linh'
        version={1}
        className='round'
        style={{ borderRadius: '50%' }}
      />,
    )
    const svg = new DOMParser().parseFromString(
      html,
      'image/svg+xml',
    ).documentElement
    expect(svg.getAttribute('class')).toBe('round')
    expect(svg.getAttribute('style')).toBe('border-radius:50%')
    svg.removeAttribute('class')
    svg.removeAttribute('style')
    expect(rootId(1).startsWith('peek')).toBe(true)
    expect(canon(svg)).toBe(tree(toSvg('Linh', { version: 1, id: rootId(1) })))
  })

  test('reaction props never change the markup', () => {
    const a = renderToString(<Avatar name='Ada' />)
    const b = renderToString(<Avatar name='Ada' reaction='nod' reactKey={3} />)
    expect(a).toBe(b)
  })
})

describe('animated SSR with accessories', () => {
  test('is deterministic with frames, riso and gaze', () => {
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
        const el = <Avatar name='Linh' {...o} animate />
        const html = renderToString(el)
        expect(renderToString(el)).toBe(html)
        expect(html).toContain('M-4 15L-13 63')
        expect(html).toContain('aria-label="Linh"')
        expect(tree(html)).toBe(tree(liveSvg('Linh', { ...o, id: rootId() })))
      }
  })
})

describe('animated SSR emits the live tree', () => {
  for (const { name, opts } of CASES) {
    test(`${name} ${JSON.stringify(opts)}`, () => {
      const html = renderToString(<Avatar name={name} {...opts} animate />)
      expect(tree(html)).toBe(tree(liveSvg(name, { ...opts, id: rootId() })))
    })
  }
})

/* ---------------------------------------------------------------- client */

let roots: { root: Root; host: HTMLElement }[] = []
afterEach(() => {
  for (const { root, host } of roots) {
    act(() => root.unmount())
    host.remove()
  }
  roots = []
  vi.restoreAllMocks()
})

function show(node: ReactNode) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => root.render(node))
  roots.push({ root, host })
  return {
    host,
    svg: () => host.querySelector('svg')!,
    render: (next: ReactNode) => act(() => root.render(next)),
  }
}

/* server markup, then hydrateRoot over it; console.error must stay silent */
function hydrate(node: ReactNode) {
  const host = document.createElement('div')
  host.innerHTML = renderToString(node)
  document.body.appendChild(host)
  const server = host.querySelector('svg')!
  const errors = vi.spyOn(console, 'error')
  let root!: Root
  act(() => {
    root = hydrateRoot(host, node, {
      onRecoverableError: (e) => console.error(e),
    })
  })
  roots.push({ root, host })
  return { host, server, errors }
}

describe('hydration', () => {
  for (const { name, opts } of CASES) {
    for (const animate of [false, true]) {
      test(`${name} animate=${animate} hydrates without a mismatch`, () => {
        const setAttribute = vi.spyOn(Element.prototype, 'setAttribute')
        const { host, server, errors } = hydrate(
          <Avatar name={name} {...opts} animate={animate} />,
        )
        expect(errors).not.toHaveBeenCalled()
        // React adopted the server's svg, and the first live paint is the
        // server frame: nothing is written over it
        expect(host.querySelector('svg')).toBe(server)
        expect(host.querySelectorAll('svg').length).toBe(1)
        expect(setAttribute).not.toHaveBeenCalled()
      })
    }
  }
})

describe('client', () => {
  test('animated: an activity change keeps the same svg node', () => {
    const setActivity = vi.spyOn(Live.prototype, 'setActivity')
    const view = show(<Avatar name='Ada' animate activity='idle' />)
    const svg = view.svg()
    view.render(<Avatar name='Ada' animate activity='thinking' />)
    expect(setActivity).toHaveBeenCalledWith('thinking')
    expect(view.svg()).toBe(svg)
    view.render(
      <Avatar
        name='Ada'
        animate
        activity='thinking'
        expression='happy'
        ring={{ color: '#f00', progress: 0.5 }}
      />,
    )
    expect(view.svg()).toBe(svg)
  })

  test('an identity change renders a new svg for the new face', () => {
    const view = show(<Avatar name='Ada' />)
    const svg = view.svg()
    view.render(<Avatar name='Linh' />)
    const next = view.svg()
    expect(next).not.toBe(svg)
    expect(view.host.querySelectorAll('svg').length).toBe(1)
    expect(canon(next)).toBe(tree(toSvg('Linh', { id: idOf(next) })))
  })

  test('static: a state change redraws the same svg in place', () => {
    const view = show(<Avatar name='Ada' />)
    const svg = view.svg()
    view.render(<Avatar name='Ada' expression='sad' />)
    expect(view.svg()).toBe(svg)
    expect(canon(svg)).toBe(
      tree(toSvg('Ada', { expression: 'sad', id: idOf(svg) })),
    )
    // a later re-render with other props never brings React's old children
    view.render(<Avatar name='Ada' expression='sad' className='x' />)
    expect(canon(svg)).toContain('class=x')
    expect(svg.children.length).toBeGreaterThan(0)
  })

  test('a reactKey change plays the reaction, never on mount', () => {
    const react = vi.spyOn(Live.prototype, 'react')
    const view = show(<Avatar name='Ada' animate reaction='nod' reactKey={0} />)
    expect(react).not.toHaveBeenCalled()
    view.render(<Avatar name='Ada' animate reaction='nod' reactKey={0} />)
    expect(react).not.toHaveBeenCalled()
    view.render(<Avatar name='Ada' animate reaction='nod' reactKey={1} />)
    expect(react).toHaveBeenCalledTimes(1)
    expect(react).toHaveBeenCalledWith('nod')
  })

  test('the ref reaches the live rig', () => {
    const react = vi.spyOn(Live.prototype, 'react')
    const pulse = vi.spyOn(Live.prototype, 'pulse')
    const voice = vi.spyOn(Live.prototype, 'setVoice')
    const ref = createRef<AvatarRef>()
    show(<Avatar ref={ref} name='Ada' animate />)
    ref.current!.react('wink')
    ref.current!.pulse(0.5)
    const fn = () => 0.3
    ref.current!.setVoice(fn)
    expect(react).toHaveBeenCalledWith('wink')
    expect(pulse).toHaveBeenCalledWith(0.5)
    expect(voice).toHaveBeenCalledWith(fn)
    expect(ref.current!.getHandle()).not.toBeNull()
    expect(ref.current!.element).toBe(ref.current!.getHandle()!.element)
  })

  test('voice and gaze target survive an identity change', () => {
    const voice = vi.spyOn(Live.prototype, 'setVoice')
    const lookAt = vi.spyOn(Live.prototype, 'lookAt')
    const ref = createRef<AvatarRef>()
    const view = show(<Avatar ref={ref} name='Ada' animate />)
    const fn = () => 0.3
    const spot = document.createElement('div')
    ref.current!.setVoice(fn)
    ref.current!.lookAt(spot)
    const before = ref.current!.getHandle()
    voice.mockClear()
    lookAt.mockClear()
    view.render(<Avatar ref={ref} name='Linh' animate />)
    expect(ref.current!.getHandle()).not.toBe(before)
    expect(voice).toHaveBeenCalledWith(fn)
    expect(lookAt).toHaveBeenCalledWith(spot)
  })

  test('className and style land on the svg and survive state changes', () => {
    const view = show(
      <Avatar name='Ada' className='round' style={{ width: '3rem' }} />,
    )
    view.render(
      <Avatar
        name='Ada'
        expression='happy'
        className='round'
        style={{ width: '3rem' }}
      />,
    )
    expect(view.svg().getAttribute('class')).toBe('round')
    expect(view.svg().getAttribute('style')).toContain('width: 3rem')
  })

  test('StrictMode: the double mount re-attaches cleanly', () => {
    const react = vi.spyOn(Live.prototype, 'react')
    const ref = createRef<AvatarRef>()
    const view = show(
      <StrictMode>
        <Avatar ref={ref} name='Ada' animate />
      </StrictMode>,
    )
    const svg = view.svg()
    ref.current!.react('wink')
    expect(react).toHaveBeenCalledTimes(1)
    view.render(
      <StrictMode>
        <Avatar ref={ref} name='Ada' animate expression='happy' />
      </StrictMode>,
    )
    expect(view.svg()).toBe(svg)
  })

  test('unmount stops the rig', () => {
    const destroy = vi.spyOn(Live.prototype, 'destroy')
    const view = show(<Avatar name='Ada' animate />)
    view.render(null)
    expect(destroy).toHaveBeenCalled()
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
  test('a registered plugin hat renders identically on server and client', () => {
    registerPlugins([testHat])
    const opts = { headwear: 'test-hat' as never, size: 200 }
    const html = renderToString(<Avatar name='Linh' {...opts} />)
    const svg = toSvg('Linh', { ...opts, id: rootId() })
    expect(svg).toContain('M110 40L230 40L170 0Z')
    expect(tree(html)).toBe(tree(svg))
    const { host, server, errors } = hydrate(<Avatar name='Linh' {...opts} />)
    expect(errors).not.toHaveBeenCalled()
    expect(host.querySelector('svg')).toBe(server)
    const view = show(<Avatar name='Linh' {...opts} />)
    expect(canon(view.svg())).toBe(
      tree(toSvg('Linh', { ...opts, id: idOf(view.svg()) })),
    )
  })
})

describe('AvatarGroup', () => {
  const liveOf = (ref: { current: AvatarRef | null }) =>
    (ref.current!.getHandle() as any).live as Live

  /* the last thing each Live was told to look at */
  const lastAim = (spy: MockInstance, live: Live) => {
    const i = spy.mock.contexts.lastIndexOf(live)
    return i < 0 ? undefined : spy.mock.calls[i]![0]
  }

  test('members look at the speaker, the speaker looks ahead', () => {
    const lookAt = vi.spyOn(Live.prototype, 'lookAt')
    const a = createRef<AvatarRef>()
    const b = createRef<AvatarRef>()
    const c = createRef<AvatarRef>()
    const group = (speaker: string | undefined, withC = true) => (
      <AvatarGroup speaker={speaker}>
        <Avatar ref={a} name='a' animate />
        <Avatar ref={b} name='b' animate />
        {withC ? <Avatar ref={c} name='c' animate /> : null}
      </AvatarGroup>
    )
    const view = show(group('b'))
    expect(lastAim(lookAt, liveOf(a))).toBe(liveOf(b))
    expect(lastAim(lookAt, liveOf(c))).toBe(liveOf(b))
    expect(lastAim(lookAt, liveOf(b))).toBe(null)
    view.render(group('a'))
    expect(lastAim(lookAt, liveOf(b))).toBe(liveOf(a))
    expect(lastAim(lookAt, liveOf(a))).toBe(null)
    view.render(group(undefined, false))
    expect(lastAim(lookAt, liveOf(a))).toBe(null)
    expect(lastAim(lookAt, liveOf(b))).toBe(null)
  })

  test('renders no wrapper element', () => {
    const view = show(
      <AvatarGroup speaker='a'>
        <Avatar name='a' />
      </AvatarGroup>,
    )
    expect(view.host.firstElementChild!.tagName.toLowerCase()).toBe('svg')
  })
})

// AvatarProps is part of the public surface
const _props: AvatarProps = { name: 'x', gaze: 'pointer', animate: true }
void _props
