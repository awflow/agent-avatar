import { describe, expect, test } from 'bun:test'
import { identify } from './identity'
import { toSvg } from './svg'
import { ACCESSORIES, COLORS, FACES, PARTS } from './tables'

const names = (n: number) => Array.from({ length: n }, (_, i) => `name ${i}`)

describe('identity v2', () => {
  test('v1 lists are pinned', () => {
    for (const n of names(200)) {
      const who = identify(n, { version: 1 })
      expect(who.motif).toBe('plain')
      expect(who.decor).toBe('none')
      expect(Object.keys(FACES).indexOf(who.face)).toBeLessThan(4)
      expect(Object.keys(COLORS).indexOf(who.color)).toBeLessThan(7)
      expect(PARTS.eyes.indexOf(who.eyes)).toBeLessThan(3)
      expect(PARTS.brows.indexOf(who.brows)).toBeLessThan(4)
      expect(PARTS.mouth.indexOf(who.mouth)).toBeLessThan(4)
      expect(PARTS.cheeks.indexOf(who.cheeks)).toBeLessThan(3)
      expect(PARTS.trait.indexOf(who.trait)).toBeLessThan(5)
      expect(who.eyewear).toBe('none')
      expect(who.headwear).toBe('none')
      expect(who.neckwear).toBe('none')
    }
  })

  test('v1 ignores dress', () => {
    for (const n of names(50))
      expect(identify(n, { version: 1, dress: true })).toEqual(
        identify(n, { version: 1 }),
      )
  })

  test('v2 picks from the whole lists', () => {
    const seen = {
      face: new Set<string>(),
      color: new Set<string>(),
      eyes: new Set<string>(),
      brows: new Set<string>(),
      mouth: new Set<string>(),
      cheeks: new Set<string>(),
      trait: new Set<string>(),
      motif: new Set<string>(),
    }
    for (const n of names(2000)) {
      const who = identify(n)
      for (const k of Object.keys(seen) as (keyof typeof seen)[])
        seen[k].add(who[k])
    }
    expect(seen.face.size).toBe(15)
    expect(seen.color.size).toBe(12)
    expect(seen.eyes.size).toBe(6)
    expect(seen.brows.size).toBe(4)
    expect(seen.brows.has('none')).toBe(false)
    expect(seen.mouth.size).toBe(5)
    expect(seen.mouth.has('none')).toBe(false)
    expect(seen.cheeks.size).toBe(3)
    expect(seen.trait.size).toBe(5)
    expect(seen.motif.size).toBe(7)
    expect(seen.motif.has('rays')).toBe(false)
  })

  test('dress odds', () => {
    const slots = [
      ['headwear', 45],
      ['eyewear', 25],
      ['neckwear', 20],
      ['decor', 20],
    ] as const
    const N = 4000
    const hits = { headwear: 0, eyewear: 0, neckwear: 0, decor: 0 }
    for (const n of names(N)) {
      const dressed = identify(n, { dress: true })
      const bare = identify(n)
      for (const [s] of slots) {
        if (dressed[s] !== 'none') {
          hits[s]++
          expect(ACCESSORIES[s] as readonly string[]).toContain(dressed[s])
        }
        expect(bare[s]).toBe('none')
      }
    }
    for (const [s, odds] of slots)
      expect(Math.abs((hits[s] / N) * 100 - odds)).toBeLessThanOrEqual(3)
  })

  test('odd names', () => {
    for (const n of ['', '   ', 'Zoë 🙂', 'مريم']) {
      const a = toSvg(n)
      expect(toSvg(n)).toBe(a)
      expect(/NaN|Infinity|undefined/.test(a)).toBe(false)
    }
  })

  test('golden identities at peek@2', () => {
    const pick = (n: string) => {
      const { persona, ...rest } = identify(n)
      return rest
    }
    expect(
      ['Ada Lovelace', 'Linh', 'Đoàn', '東京'].map(pick),
    ).toMatchInlineSnapshot(`
      [
        {
          "brows": "wedge",
          "cheeks": "dots",
          "color": "clay",
          "decor": "none",
          "eyes": "bead",
          "eyewear": "none",
          "face": "ghost",
          "hash": 2551461758,
          "headwear": "none",
          "key": "ada lovelace",
          "motif": "grid",
          "mouth": "cat",
          "neckwear": "none",
          "trait": "peak",
          "version": 2,
        },
        {
          "brows": "arch",
          "cheeks": "oval",
          "color": "lavender",
          "decor": "none",
          "eyes": "bead",
          "eyewear": "none",
          "face": "ghost",
          "hash": 182124976,
          "headwear": "none",
          "key": "linh",
          "motif": "speckle",
          "mouth": "cat",
          "neckwear": "none",
          "trait": "peak",
          "version": 2,
        },
        {
          "brows": "wedge",
          "cheeks": "lines",
          "color": "sand",
          "decor": "none",
          "eyes": "bead",
          "eyewear": "none",
          "face": "capsule",
          "hash": 4054591250,
          "headwear": "none",
          "key": "đoàn",
          "motif": "speckle",
          "mouth": "cat",
          "neckwear": "none",
          "trait": "dot",
          "version": 2,
        },
        {
          "brows": "dash",
          "cheeks": "lines",
          "color": "plum",
          "decor": "none",
          "eyes": "dot",
          "eyewear": "none",
          "face": "gem",
          "hash": 1759422319,
          "headwear": "none",
          "key": "東京",
          "motif": "glow",
          "mouth": "cat",
          "neckwear": "none",
          "trait": "square",
          "version": 2,
        },
      ]
    `)
  })
})
