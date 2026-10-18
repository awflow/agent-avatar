import { describe, expect, test } from 'bun:test'
import {
  defineCharacter,
  el,
  FACES,
  frames,
  registerPlugins,
} from '@awflow/avatar'
import { svgToPng, toGif } from './index'
import { readGif, readPng, same } from './test/decode'

describe('toGif with a timeline', () => {
  test('a scripted activity changes the frames from its cue on', async () => {
    const o = { size: 48, fps: 10, seconds: 1 }
    const plain = await toGif('Linh', {}, o)
    const cued = await toGif(
      'Linh',
      { timeline: [{ at: 0.5, activity: 'thinking' }] },
      o,
    )
    expect(readGif(cued).frames).toBe(10)
    expect(same(plain, cued)).toBe(false)
    // the same script, the same bytes
    expect(
      same(
        cued,
        await toGif(
          'Linh',
          { timeline: [{ at: 0.5, activity: 'thinking' }] },
          o,
        ),
      ),
    ).toBe(true)
  })

  test('a registered character animates through the public options', async () => {
    registerPlugins([
      defineCharacter({
        name: 'export-blob',
        geom: FACES.circle,
        draw: (c) => ({
          body: [
            el('circle', 'shell', {
              cx: 170,
              cy: 170,
              r: 150,
              fill: c.ink.body,
            }),
          ],
        }),
      }),
    ])
    const gif = await toGif(
      'Linh',
      {
        character: 'export-blob',
        timeline: [{ at: 0.2, reaction: 'hop' }],
      },
      { size: 32, fps: 5, seconds: 1 },
    )
    expect(readGif(gif).frames).toBe(5)
  })

  test('the frame caps still hold', async () => {
    await expect(
      toGif(
        'Linh',
        { timeline: [{ at: -1 }] },
        { size: 16, fps: 1, seconds: 1 },
      ),
    ).rejects.toThrow(RangeError)
  })
})

describe('svgToPng', () => {
  test('rasterises one frame of frames() at the asked width', async () => {
    const [svg] = frames('Linh', { size: 64 }, { fps: 1, seconds: 1 })
    const png = await svgToPng(svg!, { size: 40 })
    const info = readPng(png)
    expect([info.width, info.height]).toEqual([40, 40])
  })

  test('refuses what is not an SVG, and sizes past the limits', async () => {
    await expect(svgToPng('nope')).rejects.toThrow(TypeError)
    await expect(
      svgToPng('<svg xmlns="http://www.w3.org/2000/svg"/>', { size: 2048 }),
    ).rejects.toThrow('maxSize')
    // a very tall sheet is refused before it is drawn
    await expect(
      svgToPng(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="100" viewBox="0 0 1 100"/>',
        { size: 1024 },
      ),
    ).rejects.toThrow('maxSheet')
  })
})
