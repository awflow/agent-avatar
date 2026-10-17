/*
 * Just enough PNG and GIF reading for the tests: chunk and block walks, no
 * third-party decoder, so a bug in the encoders cannot hide behind one.
 */
import { unzlibSync } from 'fflate'

/** Byte equality. */
export const same = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((v, i) => v === b[i])

export const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

export type Chunk = { type: string; data: Uint8Array; crcOk: boolean }

export function chunks(png: Uint8Array): Chunk[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const out: Chunk[] = []
  let o = 8
  while (o < png.length) {
    const len = view.getUint32(o)
    const type = String.fromCharCode(...png.subarray(o + 4, o + 8))
    const data = png.subarray(o + 8, o + 8 + len)
    const crc = view.getUint32(o + 8 + len)
    out.push({
      type,
      data,
      crcOk: Bun.hash.crc32(png.subarray(o + 4, o + 8 + len)) === crc,
    })
    o += 12 + len
  }
  return out
}

const u32 = (b: Uint8Array, at: number) =>
  new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(at)
const u16 = (b: Uint8Array, at: number) =>
  new DataView(b.buffer, b.byteOffset, b.byteLength).getUint16(at)

/**
 * Size and frame facts of a PNG or APNG. Inflates the default image and
 * checks its length against the header, so "decodes" means it really does.
 */
export function readPng(png: Uint8Array) {
  const all = chunks(png)
  const ihdr = all.find((c) => c.type === 'IHDR')!.data
  const width = u32(ihdr, 0)
  const height = u32(ihdr, 4)
  const depth = ihdr[8]!
  const colorType = ihdr[9]!
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[
    colorType
  ]!
  const idat = all.filter((c) => c.type === 'IDAT').map((c) => c.data)
  const joined = new Uint8Array(idat.reduce((n, d) => n + d.length, 0))
  let at = 0
  for (const d of idat) {
    joined.set(d, at)
    at += d.length
  }
  const raw = unzlibSync(joined)
  const rowBytes = Math.ceil((width * channels * depth) / 8)
  const decoded =
    raw.length === height * (1 + rowBytes) && all.every((c) => c.crcOk)
  const actl = all.find((c) => c.type === 'acTL')?.data
  const fctl = all.filter((c) => c.type === 'fcTL').map((c) => c.data)
  return {
    width,
    height,
    colorType,
    decoded,
    types: all.map((c) => c.type),
    crcOk: all.every((c) => c.crcOk),
    frames: actl ? u32(actl, 0) : 1,
    fctl: fctl.length,
    delays: fctl.map((d) => [u16(d, 20), u16(d, 22)] as const),
  }
}

/** Walks a GIF's blocks: size, frame count, delays and transparency flags. */
export function readGif(gif: Uint8Array) {
  const header = String.fromCharCode(...gif.subarray(0, 6))
  const width = gif[6]! | (gif[7]! << 8)
  const height = gif[8]! | (gif[9]! << 8)
  const packed = gif[10]!
  let o = 13
  if (packed & 0x80) o += 3 * (1 << ((packed & 7) + 1))
  const delays: number[] = []
  const transparent: boolean[] = []
  const extensions: number[] = []
  let frames = 0
  const skipSubBlocks = () => {
    while (gif[o]! !== 0) o += gif[o]! + 1
    o++
  }
  while (o < gif.length) {
    const b = gif[o++]!
    if (b === 0x3b) break
    if (b === 0x21) {
      const label = gif[o++]!
      extensions.push(label)
      if (label === 0xf9) {
        const flags = gif[o + 1]!
        transparent.push(Boolean(flags & 1))
        delays.push(gif[o + 2]! | (gif[o + 3]! << 8))
      }
      skipSubBlocks()
    } else if (b === 0x2c) {
      frames++
      const p = gif[o + 8]!
      o += 9
      if (p & 0x80) o += 3 * (1 << ((p & 7) + 1))
      o++ // LZW minimum code size
      skipSubBlocks()
    } else {
      throw new Error(`unexpected GIF block 0x${b.toString(16)} at ${o - 1}`)
    }
  }
  return { header, width, height, frames, delays, transparent, extensions }
}

/** Undoes PNG row filters on an inflated 8-bit RGBA image. */
function unfilter(raw: Uint8Array, w: number, h: number): Uint8Array {
  const row = w * 4
  const out = new Uint8Array(row * h)
  for (let r = 0; r < h; r++) {
    const f = raw[r * (row + 1)]!
    const src = raw.subarray(r * (row + 1) + 1, (r + 1) * (row + 1))
    const o = r * row
    for (let i = 0; i < row; i++) {
      const a = i >= 4 ? out[o + i - 4]! : 0
      const b = r ? out[o - row + i]! : 0
      const c = r && i >= 4 ? out[o - row + i - 4]! : 0
      const p = a + b - c
      const pa = Math.abs(p - a)
      const pb = Math.abs(p - b)
      const pc = Math.abs(p - c)
      const pred = [
        0,
        a,
        b,
        (a + b) >> 1,
        pa <= pb && pa <= pc ? a : pb <= pc ? b : c,
      ][f]!
      out[o + i] = (src[i]! + pred) & 0xff
    }
  }
  return out
}

/**
 * Every frame of an 8-bit RGBA APNG written with blend source and dispose
 * none, composed onto the canvas the way a viewer would.
 */
export function apngFrames(png: Uint8Array): Uint8Array[] {
  const all = chunks(png)
  const ihdr = all.find((c) => c.type === 'IHDR')!.data
  const W = u32(ihdr, 0)
  const canvas = new Uint8Array(W * u32(ihdr, 4) * 4)
  const out: Uint8Array[] = []
  for (let k = 0; k < all.length; k++) {
    const c = all[k]!
    if (c.type !== 'fcTL') continue
    const [w, h, x, y] = [4, 8, 12, 16].map((at) => u32(c.data, at)) as [
      number,
      number,
      number,
      number,
    ]
    const d = all[k + 1]!
    const z = d.type === 'IDAT' ? d.data : d.data.subarray(4)
    const px = unfilter(unzlibSync(z), w, h)
    for (let r = 0; r < h; r++)
      canvas.set(px.subarray(r * w * 4, (r + 1) * w * 4), ((y + r) * W + x) * 4)
    out.push(canvas.slice())
  }
  return out
}
