/*
 * <awf-avatar> against the core, over the shared cross-adapter cases. There
 * is no server render for a custom element: what mount() puts inside the
 * element must be toSvg's tree when static and the serialized live tree
 * when animated.
 */
import { draw, serialize, settle, toSvg } from '@awflow/avatar/adapter'
import { afterEach, describe, expect, it } from 'vitest'
import { PARITY_CASES } from '../../avatar/test/parity-cases'
import './index'

const canon = (el: Element): string => {
  const attrs = Array.from(el.attributes)
    .map((a) => `${a.name}=${a.value}`)
    .sort()
    .join(' ')
  const kids = Array.from(el.children).map(canon).join('')
  return `<${el.tagName.toLowerCase()} ${attrs}>${kids}</${el.tagName.toLowerCase()}>`
}

const tree = (svg: string) =>
  canon(new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement)

/* what an animated avatar paints first: the live tree, serialized */
const liveSvg = (name: string, opts: Parameters<typeof settle>[1]) => {
  const { who, pose, opts: d } = settle(name, opts, true)
  return serialize(draw(who, pose, d))
}

/* options as the attributes a page author would write */
function element(name: string, opts: object, animate: boolean): Element {
  const el = document.createElement('awf-avatar')
  el.setAttribute('name', name)
  for (const [k, v] of Object.entries(opts))
    el.setAttribute(k, v === true ? '' : String(v))
  if (animate) el.setAttribute('animate', '')
  document.body.appendChild(el)
  return el
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('mounted markup is the core tree', () => {
  for (const { name, opts } of PARITY_CASES) {
    it(`static ${name} ${JSON.stringify(opts)}`, () => {
      const el = element(name, opts, false)
      expect(el.querySelectorAll('svg')).toHaveLength(1)
      expect(canon(el.querySelector('svg')!)).toBe(tree(toSvg(name, opts)))
    })

    it(`animated ${name} ${JSON.stringify(opts)}`, () => {
      const el = element(name, opts, true)
      expect(el.querySelectorAll('svg')).toHaveLength(1)
      expect(canon(el.querySelector('svg')!)).toBe(tree(liveSvg(name, opts)))
    })
  }
})
