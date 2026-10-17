import {
  draw,
  registerPlugins,
  serialize,
  settle,
  toSvg,
} from '@awflow/avatar/adapter'
import { render } from 'svelte/server'
import { describe, expect, test } from 'vitest'
import { PARITY_CASES, versionOf } from '../../avatar/test/parity-cases'
import { domId } from '../src/id'
import { Avatar } from '../src/index'
import IdProbe from './id-probe.svelte'

const strip = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '')

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

/* the svg id prefix of an <Avatar> rendered alone: its $props.id() */
function rootId(version?: number): string {
  const id = strip(render(IdProbe).body).replace(/<\/?i>/g, '')
  return domId(id, version)
}

/* what an animated avatar paints first: the live tree, serialized */
const liveSvg = (name: string, opts: Parameters<typeof settle>[1]) => {
  const { who, pose, opts: d } = settle(name, opts, true)
  return serialize(draw(who, pose, d))
}

const CASES = PARITY_CASES

describe('SSR parity with toSvg', () => {
  for (const { name, opts } of CASES) {
    test(`${name} ${JSON.stringify(opts)}`, () => {
      const out = render(Avatar, { props: { name, ...opts } })
      expect(tree(strip(out.body))).toBe(
        tree(toSvg(name, { ...opts, id: rootId(versionOf(opts)) })),
      )
    })
  }

  test('ids are per render and per instance, never the content hash', () => {
    expect(rootId()).toMatch(/^awf-\w+$/)
    const out = render(Avatar, { props: { name: 'Ada', animate: true } })
    expect(out.body).toContain(`id="${rootId()}-`)
    const hashed = toSvg('Ada').match(/id="(awf-[a-z0-9]+)-/)![1]
    expect(out.body).not.toContain(`id="${hashed}-`)
  })

  test('render is stable across calls', () => {
    const a = render(Avatar, { props: { name: 'Ada', expression: 'happy' } })
    const b = render(Avatar, { props: { name: 'Ada', expression: 'happy' } })
    expect(a.body).toBe(b.body)
  })

  test('carries the accessible name and known geometry', () => {
    const out = render(Avatar, {
      props: { name: 'Linh', neckwear: 'tie', size: 300 },
    })
    expect(out.body).toContain('aria-label="Linh"')
    expect(out.body).toContain('M-4 15L-13 63')
  })

  test('version pins and class and style pass through to the svg', () => {
    const out = render(Avatar, {
      props: {
        name: 'Linh',
        version: 1,
        class: 'round',
        style: 'border-radius: 50%',
      },
    })
    const svg = new DOMParser().parseFromString(
      strip(out.body),
      'image/svg+xml',
    ).documentElement
    expect(svg.getAttribute('class')).toBe('round')
    expect(svg.getAttribute('style')).toBe('border-radius: 50%')
    svg.removeAttribute('class')
    svg.removeAttribute('style')
    expect(rootId(1).startsWith('peek-')).toBe(true)
    expect(canon(svg)).toBe(tree(toSvg('Linh', { version: 1, id: rootId(1) })))
  })

  test('reaction props never change the markup', () => {
    const a = render(Avatar, { props: { name: 'Ada' } })
    const b = render(Avatar, {
      props: { name: 'Ada', reaction: 'nod', reactKey: 3 },
    })
    expect(a.body).toBe(b.body)
  })
})

describe('animated SSR emits the live tree', () => {
  for (const { name, opts } of CASES) {
    test(`${name} ${JSON.stringify(opts)}`, () => {
      const out = render(Avatar, { props: { name, ...opts, animate: true } })
      expect(tree(strip(out.body))).toBe(
        tree(liveSvg(name, { ...opts, id: rootId(versionOf(opts)) })),
      )
    })
  }
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

describe('packaging', () => {
  test('src holds no tests: svelte-package ships all of src', async () => {
    const { readdirSync } = await import('node:fs')
    // src is flat: svelte-package copies every file in it
    const files = readdirSync('src')
    expect(files.filter((f) => /\.test\./.test(f))).toEqual([])
  })
})

describe('plugins', () => {
  test('a registered plugin hat renders as toSvg does', () => {
    registerPlugins([testHat])
    const opts = { headwear: 'test-hat' as never, size: 200 }
    const out = render(Avatar, { props: { name: 'Linh', ...opts } })
    const svg = toSvg('Linh', { ...opts, id: rootId() })
    expect(svg).toContain('M110 40L230 40L170 0Z')
    expect(tree(strip(out.body))).toBe(tree(svg))
  })
})
