import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineAvatarElements } from './define'
import './index'

type El = HTMLElement & {
  handle: {
    element: SVGSVGElement
    set: (p: object) => void
    lookAt: (t: unknown) => void
  } | null
  react(name: string): void
  pulse(s?: number): void
  setVoice(f: (() => number) | null): void
  lookAt(t: unknown): void
  ring: unknown
  gaze: unknown
}

const make = (html: string) => {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}
const avatar = (host: HTMLElement, i = 0) =>
  host.querySelectorAll('awf-avatar')[i] as El

afterEach(() => {
  document.body.innerHTML = ''
})

describe('definition', () => {
  it('defines both tags on import and survives a second define', () => {
    expect(customElements.get('awf-avatar')).toBeTruthy()
    expect(customElements.get('awf-avatar-group')).toBeTruthy()
    expect(() => defineAvatarElements()).not.toThrow()
    expect(() => defineAvatarElements('awf')).not.toThrow()
  })

  it('defines under another prefix', () => {
    defineAvatarElements('xyz')
    const host = make('<xyz-avatar name="Ada"></xyz-avatar>')
    expect(host.querySelector('svg')).toBeTruthy()
  })

  it('importing the module twice does not throw', async () => {
    vi.resetModules()
    await expect(import('./index')).resolves.toBeTruthy()
  })
})

describe('mounting', () => {
  it('renders an svg from the name', () => {
    const host = make('<awf-avatar name="Ada"></awf-avatar>')
    const el = avatar(host)
    expect(el.querySelector('svg')).toBeTruthy()
    expect(el.handle?.element).toBe(el.querySelector('svg'))
  })

  it('renders nothing without a name, then mounts when it appears', () => {
    const host = make('<awf-avatar></awf-avatar>')
    const el = avatar(host)
    expect(el.querySelector('svg')).toBeNull()
    expect(el.handle).toBeNull()
    el.setAttribute('name', 'Ada')
    expect(el.querySelector('svg')).toBeTruthy()
  })

  it('applies the initial attributes', () => {
    const host = make(
      '<awf-avatar name="Ada" size="128" expression="happy" riso></awf-avatar>',
    )
    const svg = avatar(host).querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('128')
  })

  it('removing the element destroys the handle', () => {
    const host = make('<awf-avatar name="Ada"></awf-avatar>')
    const el = avatar(host)
    const handle = el.handle!
    const destroy = vi.spyOn(handle as never as { destroy(): void }, 'destroy')
    el.remove()
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(el.handle).toBeNull()
  })

  it('re-connecting after a move remounts cleanly', () => {
    const host = make('<awf-avatar name="Ada"></awf-avatar><div id="b"></div>')
    const el = avatar(host)
    const first = el.handle!
    const destroy = vi.spyOn(first as never as { destroy(): void }, 'destroy')
    host.querySelector('#b')!.appendChild(el)
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(el.handle).toBeTruthy()
    expect(el.handle).not.toBe(first)
    expect(el.querySelectorAll('svg')).toHaveLength(1)
  })

  it('methods before connection are harmless', () => {
    const el = document.createElement('awf-avatar') as El
    expect(() => {
      el.react('nod')
      el.pulse()
      el.setVoice(null)
      el.lookAt(null)
    }).not.toThrow()
  })
})

describe('attribute parsing', () => {
  const setup = () => {
    const host = make('<awf-avatar name="Ada"></awf-avatar>')
    const el = avatar(host)
    const set = vi.spyOn(el.handle!, 'set')
    return { el, set }
  }

  it('parses numbers and ignores NaN', () => {
    const { el, set } = setup()
    el.setAttribute('size', '96')
    expect(set).toHaveBeenLastCalledWith({ size: 96 })
    set.mockClear()
    el.setAttribute('size', 'big')
    el.setAttribute('version', '')
    expect(set).not.toHaveBeenCalled()
  })

  it('parses gaze pairs, clamped, and pointer', () => {
    const { el, set } = setup()
    el.setAttribute('gaze', '0.5, -2')
    expect(set).toHaveBeenLastCalledWith({ gaze: [0.5, -1] })
    el.setAttribute('gaze', '3,3')
    expect(set).toHaveBeenLastCalledWith({ gaze: [1, 1] })
    el.setAttribute('gaze', 'pointer')
    expect(set).toHaveBeenLastCalledWith({ gaze: 'pointer' })
    set.mockClear()
    el.setAttribute('gaze', 'left')
    el.setAttribute('gaze', '1')
    el.setAttribute('gaze', 'a,b')
    expect(set).not.toHaveBeenCalled()
  })

  it('treats booleans by presence', () => {
    const { el, set } = setup()
    el.setAttribute('animate', '')
    expect(set).toHaveBeenLastCalledWith({ animate: true })
    el.removeAttribute('animate')
    expect(set).toHaveBeenLastCalledWith({ animate: undefined })
    el.setAttribute('animate', 'false')
    expect(set).toHaveBeenLastCalledWith({ animate: false })
    el.setAttribute('riso', 'riso')
    expect(set).toHaveBeenLastCalledWith({ riso: true })
    el.setAttribute('dress', '')
    expect(set).toHaveBeenLastCalledWith({ dress: true })
    el.setAttribute('square', 'false')
    expect(set).toHaveBeenLastCalledWith({ square: false })
  })

  it('parses ring as JSON and ignores invalid JSON', () => {
    const { el, set } = setup()
    el.setAttribute('ring', '{"color":"#f00","progress":0.5}')
    expect(set).toHaveBeenLastCalledWith({
      ring: { color: '#f00', progress: 0.5 },
    })
    set.mockClear()
    el.setAttribute('ring', '{nope')
    el.setAttribute('ring', '42')
    expect(set).not.toHaveBeenCalled()
    el.removeAttribute('ring')
    expect(set).toHaveBeenLastCalledWith({ ring: undefined })
  })

  it('passes strings through and maps react-key', () => {
    const { el, set } = setup()
    el.setAttribute('expression', 'happy')
    expect(set).toHaveBeenLastCalledWith({ expression: 'happy' })
    el.setAttribute('react-key', '7')
    expect(set).toHaveBeenLastCalledWith({ reactKey: '7' })
    el.setAttribute('label', 'Ada, host')
    expect(set).toHaveBeenLastCalledWith({ title: 'Ada, host' })
    el.setAttribute('fx', 'false')
    expect(set).toHaveBeenLastCalledWith({ fx: false })
  })

  it('changing the activity keeps the inner svg', () => {
    const host = make('<awf-avatar name="Ada"></awf-avatar>')
    const el = avatar(host)
    const svg = el.querySelector('svg')
    el.setAttribute('activity', 'thinking')
    expect(el.querySelector('svg')).toBe(svg)
    expect(el.querySelectorAll('svg')).toHaveLength(1)
  })

  it('an identity attribute rebuilds, with one svg left', () => {
    const host = make('<awf-avatar name="Ada"></awf-avatar>')
    const el = avatar(host)
    el.setAttribute('name', 'Linh')
    expect(el.querySelectorAll('svg')).toHaveLength(1)
    el.setAttribute('shape', 'cube')
    expect(el.querySelectorAll('svg')).toHaveLength(1)
  })

  it('removing the name unmounts', () => {
    const host = make('<awf-avatar name="Ada"></awf-avatar>')
    const el = avatar(host)
    el.removeAttribute('name')
    expect(el.handle).toBeNull()
    expect(el.querySelector('svg')).toBeNull()
  })

  it('property setters take objects', () => {
    const { el, set } = setup()
    el.ring = { color: '#0f0' }
    expect(set).toHaveBeenLastCalledWith({ ring: { color: '#0f0' } })
    expect(el.ring).toEqual({ color: '#0f0' })
  })
})

describe('methods', () => {
  it('delegates to the handle', () => {
    const host = make('<awf-avatar name="Ada" animate></awf-avatar>')
    const el = avatar(host)
    const h = el.handle as never as Record<string, (...a: unknown[]) => void>
    const react = vi.spyOn(h, 'react')
    const pulse = vi.spyOn(h, 'pulse')
    const voice = vi.spyOn(h, 'setVoice')
    el.react('nod')
    el.pulse(0.5)
    el.setVoice(null)
    expect(react).toHaveBeenCalledWith('nod')
    expect(pulse).toHaveBeenCalledWith(0.5)
    expect(voice).toHaveBeenCalledWith(null)
  })

  it('lookAt resolves another avatar element to its handle', () => {
    const host = make(
      '<awf-avatar name="Ada"></awf-avatar><awf-avatar name="Linh"></awf-avatar>',
    )
    const a = avatar(host, 0)
    const b = avatar(host, 1)
    const look = vi.spyOn(a.handle!, 'lookAt')
    a.lookAt(b)
    expect(look).toHaveBeenCalledWith(b.handle)
    a.lookAt(null)
    expect(look).toHaveBeenLastCalledWith(null)
    const other = document.createElement('div')
    a.lookAt(other)
    expect(look).toHaveBeenLastCalledWith(other)
  })
})

describe('group', () => {
  const group = (speaker?: string) =>
    make(
      `<awf-avatar-group${speaker ? ` speaker="${speaker}"` : ''}>` +
        '<awf-avatar name="Ada"></awf-avatar>' +
        '<div><awf-avatar name="Linh"></awf-avatar></div>' +
        '<awf-avatar name="Sam"></awf-avatar>' +
        '</awf-avatar-group>',
    )
  const spies = (host: HTMLElement) =>
    [0, 1, 2].map((i) => vi.spyOn(avatar(host, i).handle!, 'lookAt'))

  it('aims the others at the speaker and the speaker ahead', () => {
    const host = group()
    const [a, l, s] = spies(host)
    const gr = host.querySelector('awf-avatar-group')!
    gr.setAttribute('speaker', 'Linh')
    const linh = avatar(host, 1).handle
    expect(a).toHaveBeenLastCalledWith(linh)
    expect(l).toHaveBeenLastCalledWith(null)
    expect(s).toHaveBeenLastCalledWith(linh)
  })

  it('a missing speaker sends everyone ahead', () => {
    const host = group('Ada')
    const sp = spies(host)
    host.querySelector('awf-avatar-group')!.setAttribute('speaker', 'Nobody')
    for (const s of sp) expect(s).toHaveBeenLastCalledWith(null)
  })

  it('applies the speaker present at load', () => {
    const host = group('Ada')
    const ada = avatar(host, 0).handle
    const look = vi.spyOn(avatar(host, 2).handle!, 'lookAt')
    avatar(host, 2).setAttribute('size', '40')
    host.querySelector('awf-avatar-group')!.setAttribute('speaker', 'Ada')
    expect(look).toHaveBeenLastCalledWith(ada)
  })

  it('members added later join, removed members leave', () => {
    const host = group('Ada')
    const gr = host.querySelector('awf-avatar-group')!
    const late = document.createElement('awf-avatar') as El
    late.setAttribute('name', 'Zed')
    gr.appendChild(late)
    expect(vi.spyOn(late.handle!, 'lookAt')).toBeTruthy()
    gr.setAttribute('speaker', 'Zed')
    const ada = vi.spyOn(avatar(host, 0).handle!, 'lookAt')
    late.remove()
    expect(ada).toHaveBeenLastCalledWith(null)
  })

  it('a renamed member is matched by its new name', () => {
    const host = group('Sam')
    const ada = avatar(host, 0)
    const look = vi.spyOn(ada.handle!, 'lookAt')
    avatar(host, 2).setAttribute('name', 'Sammy')
    expect(look).toHaveBeenLastCalledWith(null)
    host.querySelector('awf-avatar-group')!.setAttribute('speaker', 'Sammy')
    expect(look).toHaveBeenLastCalledWith(avatar(host, 2).handle)
  })

  it('a member moved out of the group is released', () => {
    const host = group('Ada')
    const linh = avatar(host, 1)
    const look = vi.spyOn(linh.handle!, 'lookAt')
    document.body.appendChild(linh)
    const after = linh.handle!
    expect(after).not.toBeNull()
    host.querySelector('awf-avatar-group')!.setAttribute('speaker', 'Sam')
    expect(look).not.toHaveBeenCalledWith(avatar(host, 1)?.handle)
  })

  it('re-connecting the group re-registers its members', () => {
    const host = group('Ada')
    const gr = host.querySelector('awf-avatar-group')!
    document.body.appendChild(gr)
    const linh = avatar(document.body as never, 1)
    const look = vi.spyOn(linh.handle!, 'lookAt')
    gr.setAttribute('speaker', 'Sam')
    expect(look).toHaveBeenLastCalledWith(
      avatar(document.body as never, 2).handle,
    )
  })
})

describe('upgrade and fallbacks', () => {
  it('applies properties set before the element is defined', () => {
    const early = document.createElement('qq-avatar') as El
    early.setAttribute('name', 'Ada')
    early.ring = { color: '#123456' }
    early.gaze = [0.5, 0]
    const g = document.createElement('qq-avatar-group') as HTMLElement & {
      speaker: string | null
    }
    g.speaker = 'Ada'
    g.appendChild(early)
    document.body.appendChild(g)
    defineAvatarElements('qq')
    expect(Object.hasOwn(early, 'ring')).toBe(false)
    expect(early.ring).toEqual({ color: '#123456' })
    expect(early.getAttribute('ring')).toBeNull()
    expect(early.querySelector('svg')).toBeTruthy()
    expect(g.getAttribute('speaker')).toBe('Ada')
  })

  it('keeps fallback content until an svg is mounted', () => {
    const host = make('<awf-avatar>fallback</awf-avatar>')
    const el = avatar(host)
    el.setAttribute('size', '40')
    expect(el.textContent).toBe('fallback')
    el.setAttribute('name', 'Ada')
    expect(el.textContent).toBe('')
  })
})

describe('lookAt follows its target', () => {
  it('a target that is not mounted yet', () => {
    const host = make('<awf-avatar name="Ada"></awf-avatar>')
    const a = avatar(host)
    const b = document.createElement('awf-avatar') as El
    const look = vi.spyOn(a.handle!, 'lookAt')
    a.lookAt(b)
    expect(look).toHaveBeenLastCalledWith(null)
    b.setAttribute('name', 'Linh')
    host.appendChild(b)
    expect(look).toHaveBeenLastCalledWith(b.handle)
  })

  it('a target that is moved', () => {
    const host = make(
      '<awf-avatar name="Ada"></awf-avatar><awf-avatar name="Linh"></awf-avatar><div id="d"></div>',
    )
    const a = avatar(host, 0)
    const b = avatar(host, 1)
    const look = vi.spyOn(a.handle!, 'lookAt')
    a.lookAt(b)
    host.querySelector('#d')!.appendChild(b)
    expect(b.handle).toBeTruthy()
    expect(look).toHaveBeenLastCalledWith(b.handle)
    b.remove()
    expect(look).toHaveBeenLastCalledWith(null)
  })

  it('a target that is renamed', () => {
    const host = make(
      '<awf-avatar name="Ada"></awf-avatar><awf-avatar name="Linh"></awf-avatar>',
    )
    const a = avatar(host, 0)
    const b = avatar(host, 1)
    a.lookAt(b)
    const look = vi.spyOn(a.handle!, 'lookAt')
    b.setAttribute('name', 'Sam')
    b.setAttribute('shape', 'cube')
    a.lookAt(b)
    expect(look).toHaveBeenLastCalledWith(b.handle)
    expect(b.handle).toBeTruthy()
  })
})
