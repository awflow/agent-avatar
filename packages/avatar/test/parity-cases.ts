/*
 * The cross-adapter parity cases. Every adapter (Svelte, React, Vue, Solid,
 * the custom element) renders each of these and compares its markup with
 * the core's: toSvg for a static avatar, the serialized live tree for an
 * animated one. Adapters import this file by relative path from their tests
 * (`../../avatar/test/parity-cases`); it is test-only and never published.
 *
 * Coverage, checked by parity-cases.test.ts: all five built-in themes, both
 * framings and every frame, four activities, wardrobe in every slot, a prop,
 * `dress: true` and `version: 1`.
 *
 * Plain literals with no imports, so each adapter's own props type checks
 * them where they are spread.
 */

export const PARITY_CASES = [
  {
    name: 'Ada Lovelace',
    opts: { theme: 'soft', expression: 'happy' },
  },
  {
    name: 'Linh',
    opts: { theme: 'bold', expression: 'sad', frame: 'bone' },
  },
  {
    name: 'Grace Hopper',
    opts: { theme: 'mono', framing: 'full', activity: 'thinking' },
  },
  {
    name: '東京',
    opts: {
      theme: 'neon',
      expression: 'curious',
      frame: 'paper',
      square: false,
    },
  },
  {
    name: 'Doan Labs',
    opts: { theme: 'clay', frame: 'none', activity: 'working' },
  },
  {
    name: 'Sam',
    opts: { frame: 'ink', framing: 'peek', activity: 'speaking' },
  },
  {
    name: 'Kai',
    opts: { frame: 'theme', theme: 'neon', activity: 'listening' },
  },
  {
    name: 'Mira',
    opts: {
      headwear: 'crown',
      eyewear: 'glasses',
      neckwear: 'scarf',
      face: 'freckles',
      size: 300,
    },
  },
  {
    name: 'Ola',
    opts: { prop: 'coffee', framing: 'full', expression: 'happy' },
  },
  {
    name: 'Noor',
    opts: { dress: true },
  },
  {
    name: 'Peek One',
    opts: { version: 1, expression: 'happy', frame: 'bone' },
  },
  {
    name: 'Tiny',
    opts: { size: 48, theme: 'clay', square: false },
  },
] as const

export type ParityCase = (typeof PARITY_CASES)[number]

/** A case's pinned version, if any: adapters derive the svg id prefix from it. */
export const versionOf = (opts: object): number | undefined =>
  (opts as { version?: number }).version
