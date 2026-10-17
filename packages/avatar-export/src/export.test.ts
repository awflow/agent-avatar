import { describe, expect, test } from 'bun:test'
import { FRAME_LIMITS, frames } from '@awflow/avatar'
import { paletteFor } from './animated'
import { init, LIMITS, toApng, toGif, toPng, toSprite } from './index'
import { rgba } from './raster'
import {
  apngFrames,
  PNG_SIGNATURE,
  readGif,
  readPng,
  same,
} from './test/decode'

describe('LIMITS', () => {
  test('reuses the core frame cap and adds the export caps', () => {
    expect(LIMITS).toEqual({
      maxFrames: 600,
      maxSize: 1024,
      maxSprite: 400,
      maxSheet: 16_777_216,
    })
    expect(LIMITS.maxFrames).toBe(FRAME_LIMITS.maxFrames)
    expect(Object.isFrozen(LIMITS)).toBe(true)
  })
})

describe('init', () => {
  test('is idempotent and safe to call concurrently', async () => {
    await Promise.all([init(), init(), init()])
    await init()
  })
})

describe('toPng', () => {
  test('is a 256 by 256 PNG by default', async () => {
    const png = await toPng('Linh')
    expect([...png.subarray(0, 8)]).toEqual(PNG_SIGNATURE)
    const info = readPng(png)
    expect(info.width).toBe(256)
    expect(info.height).toBe(256)
    expect(info.decoded).toBe(true)
  })

  test('is byte-identical across calls', async () => {
    const a = await toPng('Linh', { expression: 'happy' })
    const b = await toPng('Linh', { expression: 'happy' })
    expect(same(a, b)).toBe(true)
  })

  test('carries no timestamp or text chunk', async () => {
    const { types } = readPng(await toPng('Linh'))
    for (const t of ['tIME', 'tEXt', 'iTXt', 'zTXt'])
      expect(types).not.toContain(t)
  })

  test('honours size and options', async () => {
    const small = readPng(await toPng('Linh', {}, { size: 64 }))
    expect([small.width, small.height]).toEqual([64, 64])
    const a = await toPng('Linh')
    const b = await toPng('Linh', { frame: 'none' })
    expect(same(a, b)).toBe(false)
  })

  test('rejects sizes out of range, naming maxSize', async () => {
    await expect(toPng('Linh', {}, { size: 2048 })).rejects.toThrow(RangeError)
    await expect(toPng('Linh', {}, { size: 2048 })).rejects.toThrow(/maxSize/)
    for (const size of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 12.5])
      await expect(toPng('Linh', {}, { size })).rejects.toThrow(RangeError)
  })
})

describe('toApng', () => {
  test('has round(fps * seconds) frames, each 1/fps long', async () => {
    const apng = await toApng(
      'Linh',
      { activity: 'done' },
      { fps: 10, seconds: 1 },
    )
    expect([...apng.subarray(0, 8)]).toEqual(PNG_SIGNATURE)
    const info = readPng(apng)
    expect(info.frames).toBe(10)
    expect(info.fctl).toBe(10)
    expect(info.width).toBe(256)
    expect(info.decoded).toBe(true)
    for (const [num, den] of info.delays) expect(num / den).toBeCloseTo(0.1, 6)
    expect(info.types).not.toContain('tIME')
  })

  test('defaults to 24 fps for 2 seconds and plays a reaction', async () => {
    const plain = await toApng('Linh', {}, { size: 32 })
    expect(readPng(plain).frames).toBe(48)
    const waved = await toApng('Linh', { reaction: 'hop' }, { size: 32 })
    expect(same(plain, waved)).toBe(false)
  })

  test('is byte-identical across calls', async () => {
    const o = { size: 48, fps: 12, seconds: 1 }
    const a = await toApng('Linh', { reaction: 'nod' }, o)
    const b = await toApng('Linh', { reaction: 'nod' }, o)
    expect(same(a, b)).toBe(true)
  })

  test('decodes, frame by frame, to the rendered frames', async () => {
    const opts = { reaction: 'hop' as const, frame: 'none' as const }
    const o = { size: 40, fps: 6, seconds: 1 }
    const decoded = apngFrames(await toApng('Linh', opts, o))
    const svgs = frames('Linh', opts, o)
    expect(decoded.length).toBe(svgs.length)
    svgs.forEach((svg, i) => {
      expect(same(decoded[i]!, rgba(svg, 40))).toBe(true)
    })
  })

  test('checks maxFrames before rendering', async () => {
    const run = toApng('Linh', {}, { seconds: 60, fps: 60 })
    await expect(run).rejects.toThrow(RangeError)
    await expect(toApng('Linh', {}, { seconds: 60, fps: 60 })).rejects.toThrow(
      /maxFrames/,
    )
  })
})

describe('toGif', () => {
  test('has round(fps * seconds) frames', async () => {
    const gif = await toGif(
      'Linh',
      { activity: 'done' },
      { fps: 10, seconds: 1 },
    )
    const info = readGif(gif)
    expect(info.header).toBe('GIF89a')
    expect([info.width, info.height]).toEqual([256, 256])
    expect(info.frames).toBe(10)
    expect(info.delays).toEqual(Array(10).fill(10))
  })

  test('keeps the frame times exact on average', async () => {
    const { delays } = readGif(
      await toGif('Linh', {}, { size: 16, fps: 24, seconds: 1 }),
    )
    expect(delays.length).toBe(24)
    expect(delays.reduce((a, b) => a + b, 0)).toBe(100)
  })

  test('is transparent around the avatar when frame is none', async () => {
    const gif = await toGif(
      'Linh',
      { frame: 'none' },
      { size: 64, fps: 4, seconds: 1 },
    )
    const info = readGif(gif)
    expect(info.transparent.every(Boolean)).toBe(true)
  })

  test('is byte-identical across calls and has no comment block', async () => {
    const o = { size: 48, fps: 8, seconds: 1 }
    const a = await toGif('Linh', { reaction: 'hop' }, o)
    const b = await toGif('Linh', { reaction: 'hop' }, o)
    expect(same(a, b)).toBe(true)
    expect(readGif(a).extensions).not.toContain(0xfe)
  })

  test('rejects 60 seconds at 60 fps, naming maxFrames', async () => {
    await expect(toGif('Linh', {}, { seconds: 60, fps: 60 })).rejects.toThrow(
      RangeError,
    )
    await expect(toGif('Linh', {}, { seconds: 60, fps: 60 })).rejects.toThrow(
      /maxFrames/,
    )
  })

  test('rejects fps and seconds out of range, naming the limit', async () => {
    await expect(toGif('Linh', {}, { fps: 0.5 })).rejects.toThrow(/minFps/)
    await expect(toGif('Linh', {}, { fps: 240, seconds: 1 })).rejects.toThrow(
      /maxFps/,
    )
    await expect(toGif('Linh', {}, { fps: 1, seconds: 90 })).rejects.toThrow(
      /maxSeconds/,
    )
    for (const v of [Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(toGif('Linh', {}, { fps: v })).rejects.toThrow(RangeError)
      await expect(toGif('Linh', {}, { seconds: v })).rejects.toThrow(
        RangeError,
      )
    }
    await expect(toGif('Linh', {}, { seconds: 0 })).rejects.toThrow(RangeError)
    await expect(toGif('Linh', {}, { size: 4096 })).rejects.toThrow(/maxSize/)
  })
})

describe('toSprite', () => {
  test('rejects a sheet above maxSheet before rendering', async () => {
    const start = performance.now()
    const run = toSprite(Array(400).fill('x'), {}, { size: 1024 })
    await expect(run).rejects.toThrow(RangeError)
    await expect(
      toSprite(Array(400).fill('x'), {}, { size: 1024 }),
    ).rejects.toThrow(/maxSheet/)
    // 400 tiles at 1024 px would take seconds; the check takes none
    expect(performance.now() - start).toBeLessThan(200)
    const edge = await toSprite(['A', 'B', 'C', 'D'], {}, { size: 1024 })
    expect(readPng(edge).width).toBe(2048)
  })

  test('lays names out in a grid of columns', async () => {
    const sheet = await toSprite(['A', 'B', 'C'], {}, { size: 64, columns: 2 })
    const info = readPng(sheet)
    expect(info.width).toBe(128)
    expect(info.height).toBe(128)
    expect(info.decoded).toBe(true)
  })

  test('puts gap pixels between tiles', async () => {
    const gap = 8
    const info = readPng(
      await toSprite(['A', 'B', 'C'], {}, { size: 64, columns: 2, gap }),
    )
    expect(info.width).toBe(128 + gap)
    expect(info.height).toBe(128 + gap)
  })

  test('defaults to a near-square grid of 256 tiles', async () => {
    const info = readPng(await toSprite(['A', 'B', 'C', 'D', 'E']))
    expect([info.width, info.height]).toEqual([768, 512])
  })

  test('is byte-identical across calls', async () => {
    const a = await toSprite(['A', 'B'], { frame: 'none' }, { size: 32 })
    const b = await toSprite(['A', 'B'], { frame: 'none' }, { size: 32 })
    expect(same(a, b)).toBe(true)
  })

  test('rejects bad counts, columns and gaps, naming the limit', async () => {
    const many = Array.from({ length: 401 }, (_, i) => `n${i}`)
    await expect(toSprite(many, {}, { size: 1 })).rejects.toThrow(/maxSprite/)
    await expect(toSprite([])).rejects.toThrow(RangeError)
    for (const columns of [0, 1.5, Number.NaN, 401])
      await expect(toSprite(['A'], {}, { columns })).rejects.toThrow(RangeError)
    for (const gap of [-1, Number.NaN, 2048])
      await expect(toSprite(['A'], {}, { gap })).rejects.toThrow(RangeError)
  })
})

describe('GIF palette', () => {
  test('keeps a transparent entry for a clear pixel the sample skips', () => {
    // 12 opaque 512 px frames: 3.1M pixels over the 2^21 sample, stride 2,
    // so the one clear pixel at an odd offset is never sampled
    const pixels = 512 * 512
    const count = 12
    const frame = (i: number) => {
      const px = new Uint8Array(pixels * 4)
      for (let p = 0; p < pixels; p++) {
        px[p * 4] = (p * 7 + i) & 0xff
        px[p * 4 + 1] = (p >> 3) & 0xff
        px[p * 4 + 2] = (p >> 9) & 0xff
        px[p * 4 + 3] = 255
      }
      if (i === 5) px[1001 * 4 + 3] = 0
      return px
    }
    const { format, palette, transparentIndex } = paletteFor(
      count,
      pixels,
      frame,
    )
    expect(format).toBe('rgba4444')
    expect(transparentIndex).toBeGreaterThanOrEqual(0)
    expect(palette[transparentIndex]![3]).toBe(0)
    expect(palette.length).toBeLessThanOrEqual(256)
  })

  test('has no transparent entry when every pixel is opaque', () => {
    const px = new Uint8Array(16 * 16 * 4).fill(200)
    for (let a = 3; a < px.length; a += 4) px[a] = 255
    const { format, transparentIndex } = paletteFor(1, 256, () => px)
    expect(format).toBe('rgb565')
    expect(transparentIndex).toBe(-1)
  })
})

describe('browser path', () => {
  test('init(fetch(url)) under happy-dom gives the same PNG bytes as Node', async () => {
    const run = Bun.spawn(
      ['bun', new URL('./test/browser.ts', import.meta.url).pathname],
      {
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const [out, err, code] = await Promise.all([
      new Response(run.stdout).text(),
      new Response(run.stderr).text(),
      run.exited,
    ])
    if (code) throw new Error(err)
    const node = await toPng('Linh')
    expect(same(Uint8Array.from(Buffer.from(out, 'base64')), node)).toBe(true)
  })
})
