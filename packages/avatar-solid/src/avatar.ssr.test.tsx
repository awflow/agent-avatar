/*
 * <Avatar> through Solid's server renderer: the markup is exactly the
 * core's own output (toSvg static, the live tree animated) in a
 * display:contents span.
 */
import { registerPlugins } from '@awflow/avatar/adapter'
import { createUniqueId } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, test } from 'vitest'
import { Avatar, AvatarGroup, type AvatarProps } from './index'
import {
  CASES,
  liveSvg,
  ROOT_UID,
  rootId,
  span,
  testHat,
  toSvg,
} from './test/markup'

const ssr = (props: AvatarProps) => renderToString(() => <Avatar {...props} />)

test('the root component draws the unique id the fixtures assume', () => {
  let id = ''
  function Probe() {
    id = createUniqueId()
    return null
  }
  renderToString(() => <Probe />)
  expect(id).toBe(ROOT_UID)
})

describe('static SSR is exactly toSvg in a display:contents span', () => {
  for (const { name, opts } of CASES) {
    test(`${name} ${JSON.stringify(opts)}`, () => {
      expect(ssr({ name, ...opts })).toBe(
        span(toSvg(name, { ...opts, id: rootId() })),
      )
    })
  }

  test('render is stable across calls', () => {
    const p = { name: 'Ada', expression: 'happy' } as const
    expect(ssr(p)).toBe(ssr(p))
    const live = { name: 'Ada', animate: true }
    expect(ssr(live)).toBe(ssr(live))
  })

  test('carries the accessible name and known geometry', () => {
    const html = ssr({ name: 'Linh', neckwear: 'tie', size: 300 })
    expect(html).toContain('aria-label="Linh"')
    expect(html).toContain('M-4 15L-13 63')
  })

  test('version pins the drawing and the peek- id prefix', () => {
    expect(ssr({ name: 'Linh', version: 1 })).toBe(
      span(toSvg('Linh', { version: 1, id: rootId(1) })),
    )
    expect(rootId(1).startsWith('peek-')).toBe(true)
    expect(ssr({ name: 'Ada' })).toContain(`id="${rootId()}-`)
    expect(rootId().startsWith('awf-')).toBe(true)
  })

  test('class and style land on the svg root', () => {
    const html = ssr({
      name: 'Linh',
      class: 'round',
      style: { 'border-radius': '50%', width: '3rem' },
    })
    const svg = toSvg('Linh', { id: rootId() })
    expect(html).toBe(
      span(
        svg.replace(
          /^<svg([^>]*)>/,
          '<svg$1 class="round" style="border-radius:50%;width:3rem">',
        ),
      ),
    )
    expect(ssr({ name: 'Linh', style: 'width:3rem' })).toContain(
      'style="width:3rem">',
    )
  })

  test('reaction props never change the markup', () => {
    expect(ssr({ name: 'Ada', reaction: 'nod', reactKey: 3 })).toBe(
      ssr({ name: 'Ada' }),
    )
  })

  test('gaze "pointer" renders the resting gaze', () => {
    expect(ssr({ name: 'Ada', gaze: 'pointer' })).toBe(ssr({ name: 'Ada' }))
  })
})

describe('animated SSR emits the live tree', () => {
  for (const { name, opts } of CASES) {
    test(`${name} ${JSON.stringify(opts)}`, () => {
      expect(ssr({ name, ...opts, animate: true })).toBe(
        span(liveSvg(name, { ...opts, id: rootId() })),
      )
    })
  }

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
        const html = ssr({ name: 'Linh', ...o, animate: true })
        expect(ssr({ name: 'Linh', ...o, animate: true })).toBe(html)
        expect(html).toBe(
          span(liveSvg('Linh', { ...o, gaze: [1, -1], id: rootId() })),
        )
      }
  })
})

describe('plugins', () => {
  test('a registered plugin hat renders exactly as toSvg', () => {
    registerPlugins([testHat])
    const svg = toSvg('Linh', {
      headwear: 'test-hat' as never,
      size: 200,
      id: rootId(),
    })
    expect(svg).toContain('M110 40L230 40L170 0Z')
    expect(
      ssr({ name: 'Linh', headwear: 'test-hat' as never, size: 200 }),
    ).toBe(span(svg))
  })
})

describe('AvatarGroup', () => {
  test('server-renders its members with no wrapper', () => {
    const html = renderToString(() => (
      <AvatarGroup speaker='a'>
        <Avatar name='a' />
        <Avatar name='b' />
      </AvatarGroup>
    ))
    expect(html.startsWith('<span ')).toBe(true)
    expect(html.match(/<svg /g)?.length).toBe(2)
    expect(html.match(/<span /g)?.length).toBe(2)
  })
})

describe('dist', () => {
  test('the published server build renders the same markup', async () => {
    const dist = await import('../dist/server.js')
    const html = renderToString(() => <dist.Avatar name='Ada' animate />)
    expect(html).toBe(span(liveSvg('Ada', { id: rootId() })))
  })
})
