/*
 * What the server sends for one <Avatar> rendered at the root, built from
 * the core alone. The server tests check renderToString against it byte for
 * byte; the client tests hydrate it. Together they prove the client adopts
 * exactly what the server renders.
 */
import {
  type AvatarOptions,
  draw,
  serialize,
  settle,
  toSvg,
} from '@awflow/avatar/adapter'

/** The hydration key of the root component's span. */
export const ROOT_HK = '01'
/** createUniqueId() in the root component, server side and hydrating. */
export const ROOT_UID = '00'

/** The svg id the root avatar carries at `version`. */
export const rootId = (version?: number) =>
  `${(version ?? 2) >= 2 ? 'awf' : 'peek'}-${ROOT_UID}`

/** The span wrapping an avatar's svg, as Solid's renderToString writes it. */
export const span = (svg: string, hk = ROOT_HK) =>
  `<span data-hk="${hk}" style="display:contents">${svg}</span>`

/** What an animated avatar paints first: the live tree, serialized. */
export function liveSvg(name: string, opts: AvatarOptions): string {
  const { who, pose, opts: d } = settle(name, opts, true)
  return serialize(draw(who, pose, d))
}

export { toSvg }

export const CASES = [
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

// a plain-object plugin: register the same one on the server and the client
export const testHat = {
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
