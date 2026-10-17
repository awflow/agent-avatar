/*
 * The freeze: the exact bytes `toSvg` draws at style version 2, summed with
 * fnv1a, so a drawing change after 1.0.0 cannot slip through unseen. The
 * peek@1 bytes are pinned separately against @doan-labs/peek (parity-v1).
 *
 * A failing sum here means a released name now renders differently. That is
 * a breaking change: it needs a new style version, not a new sum. To print
 * the current sums (only when a new, unreleased version is being cut), run
 * `GOLDEN_PRINT=1 bun test src/golden-v2.test.ts`.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { fnv1a } from './identity'
import { el } from './node'
import {
  defineAccessory,
  registerPlugins,
  resetPluginsForTests,
} from './plugins'
import { toSvg } from './svg'
import { ACCESSORIES, FACES, PROPS } from './tables'
import { THEMES } from './themes'

const V = 2
const sum = (parts: string[]) => fnv1a(parts.join('\n')).toString(36)
const print = (label: string, v: unknown) => {
  if (process.env.GOLDEN_PRINT)
    console.log(`${label} ${JSON.stringify(v, null, 2)}`)
}

/** Forty names, a spread of scripts, lengths and punctuation. */
const NAMES = [
  'Ada',
  'Linh',
  'Zed Okafor',
  'Mira',
  'Kofi',
  'Noor',
  'Sven',
  'Yuki',
  'Amara',
  'Oleg',
  'Priya',
  'Mateo',
  'Ines',
  'Tariq',
  'Freya',
  'Hugo',
  'Lena',
  'Omar',
  'Chloe',
  'Ravi',
  'Sana',
  'Bjorn',
  'Dara',
  'Elif',
  'Jonas',
  'Keiko',
  'Luca',
  'Maya',
  'Nico',
  'Paz',
  'Quinn',
  'Rosa',
  'Sol',
  'Tess',
  'Uma',
  'Vik',
  'Wren',
  'Xavi',
  'Yara',
  'Zoe',
]
const ACTS = ['idle', 'thinking', 'speaking', 'done'] as const
const THEME_LIST = Object.keys(THEMES)
const FRAMINGS = ['peek', 'full'] as const

/** Per name: 5 themes x peek/full x 4 activities x dress on/off. */
function byName() {
  const out: Record<string, string> = {}
  for (const name of NAMES) {
    const svgs: string[] = []
    for (const theme of THEME_LIST)
      for (const framing of FRAMINGS)
        for (const activity of ACTS)
          for (const dress of [false, true])
            svgs.push(
              toSvg(name, {
                version: V,
                size: 120,
                theme,
                framing,
                activity,
                dress,
              }),
            )
    out[name] = sum(svgs)
  }
  return out
}

const SHAPES3 = ['circle', 'diamond', 'semicircle'] as const
type Slot = 'headwear' | 'eyewear' | 'neckwear' | 'decor'
const SLOTS: Record<Slot, string> = {
  headwear: 'headwear',
  eyewear: 'eyewear',
  neckwear: 'neckwear',
  decor: 'face',
}

const hat = defineAccessory({
  slot: 'headwear',
  name: 'golden-hat',
  draw: (c) => {
    const top = c.sh.crown.poly[0]![1] - c.sh.crown.r
    return [
      el('path', 'cap', {
        d: `M130 ${top + 6}L170 ${top - 34}L210 ${top + 6}Z`,
        fill: c.ink.body,
      }),
    ]
  },
})

/** Every item and every prop x 3 shapes x peek/full, plus one plugin hat. */
function wardrobe() {
  const out: Record<string, string> = {}
  const one = (extra: Record<string, unknown>) => {
    const svgs: string[] = []
    for (const shape of SHAPES3)
      for (const framing of FRAMINGS)
        svgs.push(
          toSvg('Ada', {
            version: V,
            size: 200,
            shape,
            framing,
            ...extra,
          } as never),
        )
    return sum(svgs)
  }
  for (const slot of Object.keys(SLOTS) as Slot[])
    for (const item of ACCESSORIES[slot])
      if (item !== 'none') out[`${slot}:${item}`] = one({ [SLOTS[slot]]: item })
  for (const prop of PROPS)
    if (prop !== 'none') out[`prop:${prop}`] = one({ prop })
  registerPlugins([hat])
  try {
    out['plugin-headwear:golden-hat'] = one({ headwear: 'golden-hat' })
  } finally {
    resetPluginsForTests()
  }
  return out
}

afterAll(() => resetPluginsForTests())

describe('golden v2', () => {
  test('40 names x 5 themes x peek/full x 4 activities x dress on/off', () => {
    const got = byName()
    print('NAMES', got)
    expect(got).toEqual(NAME_SUMS)
  })

  test('every wardrobe item and prop x 3 shapes x peek/full, one plugin hat', () => {
    const got = wardrobe()
    print('WARDROBE', got)
    expect(got).toEqual(WARDROBE_SUMS)
  })

  test('every FACES anchor table entry', () => {
    print('FACES', FACES)
    expect(FACES).toMatchInlineSnapshot(`
      {
        "arch": {
          "body": {
            "d": "M47.6 312.8V163.2a122.4 122.4 0 0 1 244.8 0v149.6z",
            "stroke": 17,
          },
          "bottom": 312.8,
          "brow": {
            "arch": 15,
            "hw": 22.61,
            "w": 5.62,
            "y": 122.4,
          },
          "cheeks": [
            [
              88.4,
              214.2,
            ],
            [
              251.6,
              214.2,
            ],
          ],
          "crown": {
            "poly": [
              [
                170,
                163.2,
              ],
            ],
            "r": 130.9,
          },
          "crx": 11.25,
          "cry": 5.62,
          "eyes": [
            [
              119,
              170,
            ],
            [
              221,
              170,
            ],
          ],
          "hw": 81.6,
          "mouth": {
            "d": 16.25,
            "sw": 4.38,
            "w": 16,
            "x": 170,
            "y": 231.2,
          },
          "neck": 256.2,
          "pr": 12.38,
          "rx": 23.8,
          "ry": 27.2,
          "side": 122.4,
          "sink": 30,
        },
        "bean": {
          "body": {
            "d": "M95.2 81.6h149.6a88.4 88.4 0 0 1 0 176.8H95.2a88.4 88.4 0 0 1 0-176.8z",
          },
          "bottom": 258.4,
          "brow": {
            "arch": 15,
            "hw": 22.61,
            "w": 5.62,
            "y": 115.6,
          },
          "cheeks": [
            [
              64.6,
              193.8,
            ],
            [
              275.4,
              193.8,
            ],
          ],
          "crown": {
            "poly": [
              [
                170,
                170,
              ],
              [
                244.8,
                170,
              ],
              [
                95.2,
                170,
              ],
            ],
            "r": 88.4,
          },
          "crx": 11.25,
          "cry": 5.62,
          "eyes": [
            [
              108.8,
              156.4,
            ],
            [
              231.2,
              156.4,
            ],
          ],
          "hw": 108.8,
          "mouth": {
            "d": 16.25,
            "sw": 4.38,
            "w": 16,
            "x": 170,
            "y": 207.4,
          },
          "neck": 232.4,
          "pr": 12.38,
          "rx": 23.8,
          "ry": 25.16,
          "side": 163.2,
          "sink": 0,
        },
        "blob": {
          "body": {
            "d": "M170 23.8C244.8 20.4 316.2 74.8 312.8 159.8C309.4 244.8 258.4 316.2 170 316.2C81.6 316.2 27.2 251.6 27.2 170C27.2 85 95.2 27.2 170 23.8Z",
          },
          "bottom": 316.2,
          "brow": {
            "arch": 15,
            "hw": 25.19,
            "w": 5.62,
            "y": 105.4,
          },
          "cheeks": [
            [
              81.6,
              204,
            ],
            [
              258.4,
              204,
            ],
          ],
          "crown": {
            "poly": [
              [
                170,
                170,
              ],
            ],
            "r": 144.5,
          },
          "crx": 11.25,
          "cry": 5.62,
          "eyes": [
            [
              115.6,
              156.4,
            ],
            [
              224.4,
              156.4,
            ],
          ],
          "hw": 85,
          "mouth": {
            "d": 16.25,
            "sw": 4.38,
            "w": 16,
            "x": 170,
            "y": 221,
          },
          "neck": 246,
          "pr": 13.79,
          "rx": 26.52,
          "ry": 28.56,
          "side": 142.8,
          "sink": 30,
        },
        "capsule": {
          "body": {
            "d": "M170 13.6a95.2 95.2 0 0 1 95.2 95.2v122.4a95.2 95.2 0 0 1-190.4 0V108.8A95.2 95.2 0 0 1 170 13.6z",
          },
          "bottom": 326.4,
          "brow": {
            "arch": 15,
            "hw": 18.73,
            "w": 5.62,
            "y": 95.2,
          },
          "cheeks": [
            [
              108.8,
              173.4,
            ],
            [
              231.2,
              173.4,
            ],
          ],
          "crown": {
            "poly": [
              [
                170,
                108.8,
              ],
              [
                170,
                231.2,
              ],
            ],
            "r": 95.2,
          },
          "crx": 11.25,
          "cry": 5.62,
          "eyes": [
            [
              132.6,
              136,
            ],
            [
              207.4,
              136,
            ],
          ],
          "hw": 68,
          "mouth": {
            "d": 16.25,
            "sw": 4.38,
            "w": 16,
            "x": 170,
            "y": 190.4,
          },
          "neck": 215.4,
          "pr": 10.25,
          "rx": 19.72,
          "ry": 22.44,
          "side": 95.2,
          "sink": 30,
        },
        "circle": {
          "body": {
            "circle": [
              170,
              170,
              150,
            ],
          },
          "bottom": 320,
          "brow": {
            "arch": 15.6,
            "hw": 23.4,
            "w": 5.85,
            "y": 110.2,
          },
          "cheeks": [
            [
              84.2,
              203.8,
            ],
            [
              255.8,
              203.8,
            ],
          ],
          "crown": {
            "poly": [
              [
                170,
                170,
              ],
            ],
            "r": 150,
          },
          "crx": 11.7,
          "cry": 5.85,
          "eyes": [
            [
              112.8,
              162.2,
            ],
            [
              227.2,
              162.2,
            ],
          ],
          "hw": 88,
          "mouth": {
            "d": 16.9,
            "sw": 4.55,
            "w": 16.9,
            "x": 170,
            "y": 223.3,
          },
          "neck": 248.3,
          "pr": 13,
          "rx": 29.9,
          "ry": 29.9,
          "side": 150,
          "sink": 20,
        },
        "cloud": {
          "body": {
            "d": "M170 47.6A51 51 0 0 1 256.55 83.45A51 51 0 0 1 292.4 170A51 51 0 0 1 256.55 256.55A51 51 0 0 1 170 292.4A51 51 0 0 1 83.45 256.55A51 51 0 0 1 47.6 170A51 51 0 0 1 83.45 83.45A51 51 0 0 1 170 47.6Z",
          },
          "bottom": 316.2,
          "brow": {
            "arch": 15,
            "hw": 22.61,
            "w": 5.62,
            "y": 115.6,
          },
          "cheeks": [
            [
              88.4,
              200.6,
            ],
            [
              251.6,
              200.6,
            ],
          ],
          "crown": {
            "poly": [
              [
                170,
                84.16,
              ],
              [
                205.55,
                84.16,
              ],
              [
                255.84,
                134.45,
              ],
              [
                255.84,
                205.55,
              ],
              [
                205.55,
                255.84,
              ],
              [
                134.45,
                255.84,
              ],
              [
                84.16,
                205.55,
              ],
              [
                84.16,
                134.45,
              ],
              [
                134.45,
                84.16,
              ],
            ],
            "r": 51,
          },
          "crx": 11.25,
          "cry": 5.62,
          "eyes": [
            [
              122.4,
              163.2,
            ],
            [
              217.6,
              163.2,
            ],
          ],
          "hw": 74.8,
          "mouth": {
            "d": 16.25,
            "sw": 4.38,
            "w": 16,
            "x": 170,
            "y": 217.6,
          },
          "neck": 242.6,
          "pr": 12.38,
          "rx": 23.8,
          "ry": 25.84,
          "side": 136,
          "sink": 30,
        },
        "cube": {
          "body": {
            "d": "M102 20.4h136a81.6 81.6 0 0 1 81.6 81.6v136a81.6 81.6 0 0 1-81.6 81.6H102A81.6 81.6 0 0 1 20.4 238V102A81.6 81.6 0 0 1 102 20.4z",
          },
          "bottom": 319.6,
          "brow": {
            "arch": 15,
            "hw": 24.55,
            "w": 5.62,
            "y": 108.8,
          },
          "cheeks": [
            [
              78.2,
              207.4,
            ],
            [
              261.8,
              207.4,
            ],
          ],
          "crown": {
            "poly": [
              [
                170,
                102,
              ],
              [
                238,
                102,
              ],
              [
                238,
                238,
              ],
              [
                102,
                238,
              ],
              [
                102,
                102,
              ],
            ],
            "r": 81.6,
          },
          "crx": 11.25,
          "cry": 5.62,
          "eyes": [
            [
              112.2,
              156.4,
            ],
            [
              227.8,
              156.4,
            ],
          ],
          "hw": 108.8,
          "mouth": {
            "d": 16.25,
            "sw": 4.38,
            "w": 16,
            "x": 170,
            "y": 224.4,
          },
          "neck": 249.4,
          "pr": 13.44,
          "rx": 25.84,
          "ry": 28.56,
          "side": 149.6,
          "sink": 30,
        },
        "diamond": {
          "body": {
            "d": "M170 20L320 170L170 320L20 170Z",
          },
          "bottom": 320,
          "brow": {
            "arch": 15,
            "hw": 18.75,
            "w": 5.62,
            "y": 102.5,
          },
          "cheeks": [
            [
              117.5,
              200,
            ],
            [
              222.5,
              200,
            ],
          ],
          "crown": {
            "poly": [
              [
                170,
                20,
              ],
              [
                320,
                170,
              ],
              [
                170,
                320,
              ],
              [
                20,
                170,
              ],
            ],
            "r": 0,
          },
          "crx": 11.25,
          "cry": 5.62,
          "eyes": [
            [
              132.5,
              155,
            ],
            [
              207.5,
              155,
            ],
          ],
          "hw": 30,
          "mouth": {
            "d": 16.25,
            "sw": 4.38,
            "w": 15,
            "x": 170,
            "y": 218.75,
          },
          "neck": 243.75,
          "pr": 10,
          "rx": 20,
          "ry": 27.5,
          "side": 133,
          "sink": 30,
        },
        "drop": {
          "body": {
            "d": "M170 13.6c44.2 57.8 129.2 108.8 129.2 180.2a129.2 129.2 0 0 1-258.4 0C40.8 122.4 125.8 71.4 170 13.6z",
          },
          "bottom": 323,
          "brow": {
            "arch": 15,
            "hw": 21.96,
            "w": 5.62,
            "y": 153,
          },
          "cheeks": [
            [
              88.4,
              234.6,
            ],
            [
              251.6,
              234.6,
            ],
          ],
          "crown": {
            "poly": [
              [
                170,
                13.6,
              ],
              [
                251.26,
                98.6,
              ],
              [
                285.26,
                143.82,
              ],
              [
                299.2,
                193.8,
              ],
              [
                281.86,
                258.4,
              ],
              [
                234.6,
                306,
              ],
              [
                170,
                323,
              ],
              [
                105.4,
                306,
              ],
              [
                58.14,
                258.4,
              ],
              [
                40.8,
                193.8,
              ],
              [
                54.74,
                143.82,
              ],
              [
                88.74,
                98.6,
              ],
            ],
            "r": 0,
          },
          "crx": 11.25,
          "cry": 5.62,
          "eyes": [
            [
              125.8,
              197.2,
            ],
            [
              214.2,
              197.2,
            ],
          ],
          "hw": 27.2,
          "mouth": {
            "d": 16.25,
            "sw": 4.38,
            "w": 16,
            "x": 170,
            "y": 251.6,
          },
          "neck": 276.6,
          "pr": 12.02,
          "rx": 23.12,
          "ry": 25.84,
          "side": 125.8,
          "sink": 30,
        },
        "flower": {
          "body": {
            "d": "M217.6 87.55A51 51 0 1 1 265.2 170A51 51 0 1 1 217.6 252.45A51 51 0 1 1 122.4 252.45A51 51 0 1 1 74.8 170A51 51 0 1 1 122.4 87.55A51 51 0 1 1 217.6 87.55Z",
          },
          "bottom": 319.6,
          "brow": {
            "arch": 15,
            "hw": 21.32,
            "w": 5.62,
            "y": 119,
          },
          "cheeks": [
            [
              95.2,
              197.2,
            ],
            [
              244.8,
              197.2,
            ],
          ],
          "crown": {
            "poly": [
              [
                170,
                69.24,
              ],
              [
                257.26,
                119.62,
              ],
              [
                257.26,
                220.38,
              ],
              [
                170,
                270.76,
              ],
              [
                82.74,
                220.38,
              ],
              [
                82.74,
                119.62,
              ],
            ],
            "r": 51,
          },
          "crx": 11.25,
          "cry": 5.62,
          "eyes": [
            [
              125.8,
              163.2,
            ],
            [
              214.2,
              163.2,
            ],
          ],
          "hw": 47.6,
          "mouth": {
            "d": 16.25,
            "sw": 4.38,
            "w": 16,
            "x": 170,
            "y": 214.2,
          },
          "neck": 239.2,
          "pr": 11.67,
          "rx": 22.44,
          "ry": 24.48,
          "side": 136,
          "sink": 30,
        },
        "gem": {
          "body": {
            "d": "M139.4 30.6a44.2 44.2 0 0 1 61.2 0l108.8 108.8a44.2 44.2 0 0 1 0 61.2L200.6 309.4a44.2 44.2 0 0 1-61.2 0L30.6 200.6a44.2 44.2 0 0 1 0-61.2z",
          },
          "bottom": 323,
          "brow": {
            "arch": 15,
            "hw": 20.99,
            "w": 5.62,
            "y": 112.2,
          },
          "cheeks": [
            [
              98.6,
              200.6,
            ],
            [
              241.4,
              200.6,
            ],
          ],
          "crown": {
            "poly": [
              [
                170,
                62.49,
              ],
              [
                277.51,
                170,
              ],
              [
                170,
                277.51,
              ],
              [
                62.49,
                170,
              ],
            ],
            "r": 44.2,
          },
          "crx": 11.25,
          "cry": 5.62,
          "eyes": [
            [
              125.8,
              159.8,
            ],
            [
              214.2,
              159.8,
            ],
          ],
          "hw": 37.4,
          "mouth": {
            "d": 16.25,
            "sw": 4.38,
            "w": 16,
            "x": 170,
            "y": 217.6,
          },
          "neck": 242.6,
          "pr": 11.49,
          "rx": 22.1,
          "ry": 25.84,
          "side": 136,
          "sink": 30,
        },
        "ghost": {
          "body": {
            "d": "M170 20.4C251.6 20.4 312.8 81.6 312.8 163.2V299.2L272 272L231.2 306L190.4 272L149.6 306L108.8 272L68 306L27.2 278.8V163.2C27.2 81.6 88.4 20.4 170 20.4Z",
          },
          "bottom": 306,
          "brow": {
            "arch": 15,
            "hw": 23.26,
            "w": 5.62,
            "y": 102,
          },
          "cheeks": [
            [
              85,
              190.4,
            ],
            [
              255,
              190.4,
            ],
          ],
          "crown": {
            "poly": [
              [
                170,
                163.2,
              ],
            ],
            "r": 142.8,
          },
          "crx": 11.25,
          "cry": 5.62,
          "eyes": [
            [
              119,
              149.6,
            ],
            [
              221,
              149.6,
            ],
          ],
          "hw": 88.4,
          "mouth": {
            "d": 16.25,
            "sw": 4.38,
            "w": 16,
            "x": 170,
            "y": 207.4,
          },
          "neck": 232.4,
          "pr": 12.73,
          "rx": 24.48,
          "ry": 27.2,
          "side": 142.8,
          "sink": 30,
        },
        "peak": {
          "body": {
            "d": "M142.8 40.8c13.6-23.8 40.8-23.8 54.4 0l122.4 224.4c13.6 27.2-3.4 54.4-34 54.4H54.4c-30.6 0-47.6-27.2-34-54.4z",
          },
          "bottom": 319.6,
          "brow": {
            "arch": 15,
            "hw": 19.38,
            "w": 5.62,
            "y": 176.8,
          },
          "cheeks": [
            [
              95.2,
              248.2,
            ],
            [
              244.8,
              248.2,
            ],
          ],
          "crown": {
            "poly": [
              [
                170,
                54.74,
              ],
              [
                297.84,
                289,
              ],
              [
                42.16,
                289,
              ],
            ],
            "r": 30.6,
          },
          "crx": 11.25,
          "cry": 5.62,
          "eyes": [
            [
              132.6,
              217.6,
            ],
            [
              207.4,
              217.6,
            ],
          ],
          "hw": 23.8,
          "mouth": {
            "d": 16.25,
            "sw": 4.38,
            "w": 16,
            "x": 170,
            "y": 261.8,
          },
          "neck": 286.8,
          "pr": 10.61,
          "rx": 20.4,
          "ry": 23.8,
          "side": 102,
          "sink": 30,
        },
        "semicircle": {
          "body": {
            "d": "M0 255A170 170 0 0 1 340 255Z",
          },
          "bottom": 255,
          "brow": {
            "arch": 15,
            "hw": 25,
            "w": 5.62,
            "y": 127.5,
          },
          "cheeks": [
            [
              55,
              212.5,
            ],
            [
              285,
              212.5,
            ],
          ],
          "crown": {
            "poly": [
              [
                170,
                255,
              ],
            ],
            "r": 170,
          },
          "crx": 11.25,
          "cry": 5.62,
          "eyes": [
            [
              102.5,
              175,
            ],
            [
              237.5,
              175,
            ],
          ],
          "hw": 102,
          "mouth": {
            "d": 16.25,
            "sw": 4.38,
            "w": 16.25,
            "x": 170,
            "y": 221.25,
          },
          "neck": 246.25,
          "pr": 11.25,
          "rx": 30,
          "ry": 25,
          "side": 160,
          "sink": 0,
        },
        "triangle": {
          "body": {
            "d": "M170 40.8L312.8 299.2L27.2 299.2Z",
            "stroke": 27.2,
          },
          "bottom": 312.8,
          "brow": {
            "arch": 15.3,
            "hw": 18.7,
            "w": 5.62,
            "y": 166.6,
          },
          "cheeks": [
            [
              98.6,
              238,
            ],
            [
              241.4,
              238,
            ],
          ],
          "crown": {
            "poly": [
              [
                170,
                40.8,
              ],
              [
                312.8,
                299.2,
              ],
              [
                27.2,
                299.2,
              ],
            ],
            "r": 13.6,
          },
          "crx": 11.5,
          "cry": 5.75,
          "eyes": [
            [
              132.6,
              210.8,
            ],
            [
              207.4,
              210.8,
            ],
          ],
          "hw": 20,
          "mouth": {
            "d": 16.25,
            "sw": 4.38,
            "w": 17,
            "x": 170,
            "y": 254,
          },
          "neck": 279,
          "pr": 10,
          "rx": 20.4,
          "ry": 27.2,
          "side": 95,
          "sink": 0,
        },
      }
    `)
  })
})

const NAME_SUMS: Record<string, string> = {
  Ada: '1ktzj66',
  Linh: 'xuk5g7',
  'Zed Okafor': '1egpluf',
  Mira: 'mpmj3e',
  Kofi: '1y40lnz',
  Noor: '1x9p5in',
  Sven: '1mg33xz',
  Yuki: 'o8i193',
  Amara: 'qzwdnj',
  Oleg: 'l6rh0o',
  Priya: '13xgx8e',
  Mateo: '1ktsn73',
  Ines: '1bj91f',
  Tariq: '152rlmw',
  Freya: '14fi6h5',
  Hugo: '1q7n4b3',
  Lena: '16volm0',
  Omar: '17x2mb1',
  Chloe: 'oi9okg',
  Ravi: 'hhw44l',
  Sana: '1l97b4o',
  Bjorn: 'th4mul',
  Dara: '1883bh7',
  Elif: '107zmlx',
  Jonas: '1q227b2',
  Keiko: '8v0nx7',
  Luca: '16dgv2p',
  Maya: '1dseeh',
  Nico: 'onukjl',
  Paz: '1612zdr',
  Quinn: '1jslnrl',
  Rosa: '14h3d55',
  Sol: 'puvrz4',
  Tess: '180x2og',
  Uma: 'b3kuuv',
  Vik: 'er7szl',
  Wren: 'p7ua6w',
  Xavi: '1y13oq5',
  Yara: 'aiz9wy',
  Zoe: '5jetud',
}

const WARDROBE_SUMS: Record<string, string> = {
  'headwear:bow': '17b7h1s',
  'headwear:cap': 'w3vzlc',
  'headwear:sprout': '1hc860e',
  'headwear:beanie': 'kzx0oo',
  'headwear:headphones': '5wnxkg',
  'headwear:antenna': '5i02d8',
  'headwear:crown': '19pgkus',
  'headwear:wizard': 'ydcg82',
  'headwear:party': '1rnm0dc',
  'headwear:halo': '1bou5j0',
  'headwear:beret': '7cafjq',
  'headwear:chef': 'lo1xx4',
  'eyewear:glasses': '1zcrvm',
  'eyewear:sunglasses': '8xl1e',
  'eyewear:monocle': '1jo0i02',
  'eyewear:visor': '1x90iwa',
  'eyewear:patch': 'ijlgte',
  'eyewear:cateye': '1ois2li',
  'neckwear:tie': '1xo26oi',
  'neckwear:bowtie': '1npv14a',
  'neckwear:scarf': '9x8pga',
  'neckwear:necklace': '1snnd98',
  'neckwear:badge': 'ts2nnk',
  'decor:freckles': '1gufuro',
  'decor:mustache': '1uglxz2',
  'decor:bandaid': '16n1tic',
  'decor:sticker': '17idoda',
  'prop:magnifier': 'qam600',
  'prop:pencil': '12jp4ai',
  'prop:coffee': 'em44q',
  'prop:bulb': '1syoels',
  'prop:book': '31mrn0',
  'prop:wrench': '1uq7cpo',
  'plugin-headwear:golden-hat': '1p0vy8o',
}
