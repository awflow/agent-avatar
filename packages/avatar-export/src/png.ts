/*
 * A small PNG and APNG writer: 8-bit RGBA, per-row adaptive filters, zlib by
 * fflate (pure JS, the same bytes everywhere). Only the chunks an image
 * needs are written: no tIME, no text, nothing that varies between runs.
 */
import { zlibSync } from 'fflate'

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

const CRC = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC[n] = c >>> 0
}

function crc32(bytes: Uint8Array, crc = 0xffffffff): number {
  for (let i = 0; i < bytes.length; i++)
    crc = CRC[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8)
  return crc
}

class Writer {
  parts: Uint8Array[] = [Uint8Array.from(SIGNATURE)]

  chunk(type: string, data: Uint8Array) {
    const head = new Uint8Array(8)
    const view = new DataView(head.buffer)
    view.setUint32(0, data.length)
    for (let i = 0; i < 4; i++) head[4 + i] = type.charCodeAt(i)
    const tail = new Uint8Array(4)
    const crc = crc32(data, crc32(head.subarray(4)))
    new DataView(tail.buffer).setUint32(0, (crc ^ 0xffffffff) >>> 0)
    this.parts.push(head, data, tail)
  }

  bytes(): Uint8Array {
    const out = new Uint8Array(this.parts.reduce((n, p) => n + p.length, 0))
    let at = 0
    for (const p of this.parts) {
      out.set(p, at)
      at += p.length
    }
    return out
  }
}

/** Big-endian fields: [value, bytes] pairs into one buffer. */
function fields(...values: [number, 1 | 2 | 4][]): Uint8Array {
  const out = new Uint8Array(values.reduce((n, [, b]) => n + b, 0))
  const view = new DataView(out.buffer)
  let at = 0
  for (const [v, b] of values) {
    if (b === 4) view.setUint32(at, v)
    else if (b === 2) view.setUint16(at, v)
    else view.setUint8(at, v)
    at += b
  }
  return out
}

const ihdr = (w: number, h: number) =>
  fields([w, 4], [h, 4], [8, 1], [6, 1], [0, 1], [0, 1], [0, 1])

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/**
 * Filters and deflates a w by h region of an RGBA buffer `stride` pixels
 * wide. Each row takes the filter with the smallest sum of absolute signed
 * bytes, the usual heuristic.
 */
function compress(
  px: Uint8Array,
  stride: number,
  x: number,
  y: number,
  w: number,
  h: number,
): Uint8Array {
  const row = w * 4
  const raw = new Uint8Array(h * (row + 1))
  const tries = Array.from({ length: 5 }, () => new Uint8Array(row))
  for (let r = 0; r < h; r++) {
    const at = ((y + r) * stride + x) * 4
    const cur = px.subarray(at, at + row)
    const prev = r ? px.subarray(at - stride * 4, at - stride * 4 + row) : null
    let best = 0
    let bestSum = Number.POSITIVE_INFINITY
    for (let f = 0; f < 5; f++) {
      const out = tries[f]!
      let sum = 0
      for (let i = 0; i < row; i++) {
        const a = i >= 4 ? cur[i - 4]! : 0
        const b = prev ? prev[i]! : 0
        const c = prev && i >= 4 ? prev[i - 4]! : 0
        const pred =
          f === 0
            ? 0
            : f === 1
              ? a
              : f === 2
                ? b
                : f === 3
                  ? (a + b) >> 1
                  : paeth(a, b, c)
        const v = (cur[i]! - pred) & 0xff
        out[i] = v
        sum += v < 128 ? v : 256 - v
      }
      if (sum < bestSum) {
        bestSum = sum
        best = f
      }
    }
    const o = r * (row + 1)
    raw[o] = best
    raw.set(tries[best]!, o + 1)
  }
  return zlibSync(raw, { level: 9 })
}

/** A still PNG of an RGBA buffer. */
export function encodePng(px: Uint8Array, w: number, h: number): Uint8Array {
  const png = new Writer()
  png.chunk('IHDR', ihdr(w, h))
  png.chunk('IDAT', compress(px, w, 0, 0, w, h))
  png.chunk('IEND', new Uint8Array(0))
  return png.bytes()
}

/** The bounding box of the pixels that differ between two frames. */
function changed(a: Uint8Array, b: Uint8Array, w: number, h: number) {
  const A = new Uint32Array(a.buffer, a.byteOffset, w * h)
  const B = new Uint32Array(b.buffer, b.byteOffset, w * h)
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < h; y++) {
    const o = y * w
    for (let x = 0; x < w; x++) {
      if (A[o + x] === B[o + x]) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      y1 = y
    }
  }
  // an unchanged frame still needs a region: one pixel, rewritten as is
  return x1 < 0
    ? { x: 0, y: 0, w: 1, h: 1 }
    : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

/**
 * An animated PNG that loops forever. `frame(i)` gives frame i as RGBA;
 * frames are pulled one at a time so only two are held at once. Each frame
 * after the first stores only the box that changed, replacing those pixels
 * (blend source) over the previous frame left in place (dispose none).
 * `delay` is each frame's length as a [numerator, denominator] of seconds.
 */
export function encodeApng(
  count: number,
  frame: (i: number) => Uint8Array,
  w: number,
  h: number,
  delay: readonly [number, number],
): Uint8Array {
  const png = new Writer()
  png.chunk('IHDR', ihdr(w, h))
  png.chunk('acTL', fields([count, 4], [0, 4]))
  let seq = 0
  let prev: Uint8Array | undefined
  for (let i = 0; i < count; i++) {
    const px = frame(i)
    const box = prev ? changed(prev, px, w, h) : { x: 0, y: 0, w, h }
    png.chunk(
      'fcTL',
      fields(
        [seq++, 4],
        [box.w, 4],
        [box.h, 4],
        [box.x, 4],
        [box.y, 4],
        [delay[0], 2],
        [delay[1], 2],
        [0, 1],
        [0, 1],
      ),
    )
    const data = compress(px, w, box.x, box.y, box.w, box.h)
    if (i === 0) png.chunk('IDAT', data)
    else {
      const fd = new Uint8Array(4 + data.length)
      new DataView(fd.buffer).setUint32(0, seq++)
      fd.set(data, 4)
      png.chunk('fdAT', fd)
    }
    prev = px
  }
  png.chunk('IEND', new Uint8Array(0))
  return png.bytes()
}
