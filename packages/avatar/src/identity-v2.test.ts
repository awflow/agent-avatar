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
    expect(
      ['Ada Lovelace', 'Linh', 'Đoàn', '東京'].map((n) => identify(n)),
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
          "persona": {
            "add": {
              "browArch": 0.15,
              "browTilt": -0.91,
              "browY": 0.5,
              "gx": 0.08,
              "hair": 0.04,
              "my": -1.95,
              "rot": 0.07,
            },
            "blink": 0.77,
            "mul": {
              "browW": 1.16,
              "eyeS": 1.07,
              "mw": 1.07,
              "pupil": 1.03,
            },
            "spread": 2.53,
          },
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
          "persona": {
            "add": {
              "browArch": -0.08,
              "browTilt": -1.25,
              "browY": 0.07,
              "gx": -0.04,
              "hair": -0.1,
              "my": 1.18,
              "rot": 2.27,
            },
            "blink": 0.94,
            "mul": {
              "browW": 1.1,
              "eyeS": 1.08,
              "mw": 1.09,
              "pupil": 1.06,
            },
            "spread": 2.45,
          },
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
          "persona": {
            "add": {
              "browArch": 0.08,
              "browTilt": 2.03,
              "browY": -1.39,
              "gx": -0.08,
              "hair": 0.33,
              "my": 2.24,
              "rot": -1.93,
            },
            "blink": 1.05,
            "mul": {
              "browW": 0.98,
              "eyeS": 0.96,
              "mw": 0.88,
              "pupil": 0.97,
            },
            "spread": -1.13,
          },
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
          "persona": {
            "add": {
              "browArch": 0.1,
              "browTilt": -0.38,
              "browY": 2.73,
              "gx": 0.06,
              "hair": 0.15,
              "my": -1.26,
              "rot": -1.92,
            },
            "blink": 1.21,
            "mul": {
              "browW": 1.14,
              "eyeS": 1.06,
              "mw": 0.93,
              "pupil": 1.02,
            },
            "spread": -0.43,
          },
          "trait": "square",
          "version": 2,
        },
      ]
    `)
  })
})
