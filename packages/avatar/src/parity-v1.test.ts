/*
 * The peek@1 regression net. Every sum below was recorded from output already
 * proven byte-identical to @doan-labs/peek 1.2.0. If one moves, a released
 * name now draws differently: that needs a new version, not a new snapshot.
 */
import { describe, expect, test } from 'bun:test'
import { draw, type Node } from './draw'
import { fnv1a } from './identity'
import { type AvatarOptions, serialize, settle, toSvg } from './svg'
import { COLORS, EXPRESSIONS, type Expression, FACES, PARTS } from './tables'

const NAMES = [
  '',
  '   ',
  'Ada Lovelace',
  'Linh',
  'Đoàn',
  '東京',
  '👩‍💻',
  '🙂',
  'مرحبا',
  'שלום',
  'a',
  'Z',
  'ada lovelace',
  '  Ada   Lovelace  ',
  'José',
  'Zoë',
  'Ünal',
  'Søren',
  'Nguyễn Văn A',
  'Александр',
  'Ελένη',
  '김민수',
  '李雷',
  "O'Brien",
  'a&b<c>"d"',
  'x'.repeat(200),
  '0',
  '12345',
  'user@example.com',
  'agent-007',
  'Peek',
  'Doan Labs',
  'Marie Curie',
  'Alan Turing',
  'Grace Hopper',
  'Linus',
  'Margaret Hamilton',
  'Katherine Johnson',
  'Tim Berners-Lee',
  'Yuki 🌸',
]
const SIZES = [0, 24, 48, 120, 300, 600]
const EXPRESSION_LIST = Object.keys(EXPRESSIONS) as Expression[]
const V1: AvatarOptions = { version: 1 }

const sum = (parts: string[]) => fnv1a(parts.join('\u0000')).toString(36)
const over = (f: (name: string) => string[]) => sum(NAMES.flatMap(f))

describe('peek@1 parity', () => {
  test('corpus is the size we think it is', () => {
    expect(NAMES.length).toBe(40)
    expect(EXPRESSION_LIST.length).toBe(11)
  })

  test('default look, per expression', () => {
    expect(
      over((n) =>
        EXPRESSION_LIST.map((e) => toSvg(n, { ...V1, expression: e })),
      ),
    ).toMatchInlineSnapshot(`"18i2jhn"`)
  })

  test('sizes', () => {
    expect(
      over((n) => SIZES.map((size) => toSvg(n, { ...V1, size }))),
    ).toMatchInlineSnapshot(`"115j8kb"`)
  })

  test('frames, square, riso', () => {
    expect(
      over((n) =>
        (['ink', 'bone', 'paper', 'none'] as const).flatMap((frame) =>
          [true, false].flatMap((square) =>
            [true, false].map((riso) =>
              toSvg(n, { ...V1, size: 300, frame, square, riso }),
            ),
          ),
        ),
      ),
    ).toMatchInlineSnapshot(`"l5udcp"`)
  })

  test('wardrobe', () => {
    const items: AvatarOptions[] = [
      { eyewear: 'glasses' },
      { eyewear: 'sunglasses' },
      { headwear: 'bow' },
      { headwear: 'cap' },
      { headwear: 'sprout' },
      { neckwear: 'tie' },
    ]
    expect(
      over((n) => items.map((o) => toSvg(n, { ...V1, ...o }))),
    ).toMatchInlineSnapshot(`"omk1vv"`)
  })

  test('face, colour and part overrides', () => {
    const faces = Object.keys(FACES).slice(0, 4) as (keyof typeof FACES)[]
    const colors = Object.keys(COLORS).slice(0, 7) as (keyof typeof COLORS)[]
    const opts: AvatarOptions[] = [
      ...faces.map((face) => ({ face })),
      ...colors.map((color) => ({ color })),
      ...PARTS.eyes.slice(0, 3).map((eyes) => ({ eyes })),
      ...PARTS.brows.slice(0, 4).map((brows) => ({ brows })),
      ...PARTS.mouth.slice(0, 4).map((mouth) => ({ mouth })),
      ...PARTS.cheeks.slice(0, 3).map((cheeks) => ({ cheeks })),
      ...PARTS.trait.slice(0, 5).map((trait) => ({ trait })),
    ]
    expect(
      over((n) => opts.map((o) => toSvg(n, { ...V1, ...o }))),
    ).toMatchInlineSnapshot(`"2vq1tj"`)
  })

  test('gaze and title', () => {
    expect(
      over((n) => [
        toSvg(n, { ...V1, gaze: [0.5, -0.5] }),
        toSvg(n, { ...V1, gaze: [-1, 1] }),
        toSvg(n, { ...V1, title: false }),
        toSvg(n, { ...V1, title: 'a "quoted" <title> & more' }),
      ]),
    ).toMatchInlineSnapshot(`"eo831j"`)
  })

  // A live tree also carries the state layer added in Plan 2: the fx pool
  // and an invisible ring node, there so activities and a ring can come and
  // go without new nodes. Peek's part of the tree must hold byte-identical.
  const peekPart = (node: Node): Node => ({
    ...node,
    children: node.children
      .filter(
        (c) => c.key !== 'fx' && !(c.key === 'ring' && c.attrs.opacity === '0'),
      )
      .map(peekPart),
  })

  test('the live tree', () => {
    expect(
      over((n) =>
        EXPRESSION_LIST.map((expression) => {
          const { who, pose, opts } = settle(n, { ...V1, expression }, true)
          return serialize(peekPart(draw(who, pose, opts)))
        }),
      ),
    ).toMatchInlineSnapshot(`"d3js66"`)
  })
})
