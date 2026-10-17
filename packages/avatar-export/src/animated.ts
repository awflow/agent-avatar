/*
 * Animations: the core's deterministic frames(), rasterised, then written as
 * an APNG (lossless, full alpha) or a GIF (one 256-colour palette for the
 * whole animation, 1-bit transparency).
 */
import { type AvatarOptions, frames, type Reaction } from '@awflow/avatar'
import * as gifenc from 'gifenc'
import { checkSize, checkTiming } from './limits'
import { encodeApng } from './png'
import { ensure, rgba } from './raster'

export type AnimatedOptions = AvatarOptions & { reaction?: Reaction }
export type AnimationSettings = {
  /** Side in pixels, 1 to LIMITS.maxSize. Default 256. */
  size?: number
  /** Frames per second, FRAME_LIMITS.minFps to maxFps. Default 24. */
  fps?: number
  /** Length in seconds, above 0 up to FRAME_LIMITS.maxSeconds. Default 2. */
  seconds?: number
}

// Node's ESM loader sees gifenc's CommonJS build as one default export;
// bundlers read its ESM build with named ones. Either way, the same API.
const gif: typeof gifenc =
  'GIFEncoder' in gifenc && typeof gifenc.GIFEncoder === 'function'
    ? gifenc
    : (gifenc as unknown as { default: typeof gifenc }).default

/** Rendered frames are kept for a second pass only up to this many bytes. */
const KEEP_BYTES = 64 * 1024 * 1024
/** The palette is built from at most this many pixels, sampled evenly. */
const SAMPLE_PIXELS = 1 << 21

async function prepare(
  fn: string,
  name: string,
  opts: AnimatedOptions,
  o: AnimationSettings,
) {
  const size = checkSize(fn, o.size)
  const { fps, seconds, count } = checkTiming(fn, o)
  await ensure()
  const svgs = frames(name, opts, { fps, seconds })
  return { size, fps, svgs, count }
}

/**
 * An animated PNG of `seconds` of the live avatar at `fps`, looping forever.
 * Lossless with full alpha. A `reaction` in the options starts on frame one.
 */
export async function toApng(
  name: string,
  opts: AnimatedOptions = {},
  o: AnimationSettings = {},
): Promise<Uint8Array> {
  const { size, fps, svgs, count } = await prepare('toApng()', name, opts, o)
  // each frame lasts exactly 1/fps: 100/(fps*100) fits PNG's 16-bit fields
  const delay = [100, Math.round(fps * 100)] as const
  return encodeApng(count, (i) => rgba(svgs[i]!, size), size, size, delay)
}

/**
 * An animated GIF of `seconds` of the live avatar at `fps`, looping forever.
 * One 256-colour palette is quantised for the whole animation (gifenc). The
 * background is transparent wherever the avatar draws nothing, e.g. with
 * `frame: 'none'`. GIF counts time in hundredths of a second: frame delays
 * are rounded so the total stays exact.
 */
export async function toGif(
  name: string,
  opts: AnimatedOptions = {},
  o: AnimationSettings = {},
): Promise<Uint8Array> {
  const { size, fps, svgs, count } = await prepare('toGif()', name, opts, o)
  const pixels = size * size
  const keep = count * pixels * 4 <= KEEP_BYTES
  const held: Uint8Array[] = []
  const frame = (i: number) => held[i] ?? rgba(svgs[i]!, size)

  // pass one: an even sample of every frame's pixels for the palette
  const stride = Math.max(1, Math.ceil((count * pixels) / SAMPLE_PIXELS))
  const sample = new Uint8Array(Math.ceil((count * pixels) / stride) * 4)
  let taken = 0
  let next = 0
  let clear = false
  for (let i = 0; i < count; i++) {
    const px = frame(i)
    if (keep) held[i] = px
    const base = i * pixels
    for (; next < base + pixels; next += stride) {
      const at = (next - base) * 4
      sample.set(px.subarray(at, at + 4), taken * 4)
      if (px[at + 3]! < 128) clear = true
      taken++
    }
  }
  const format = clear ? 'rgba4444' : 'rgb565'
  const palette = gif.quantize(sample.subarray(0, taken * 4), 256, {
    format,
    oneBitAlpha: clear,
  })
  const transparentIndex = clear ? palette.findIndex((c) => c[3] === 0) : -1
  const transparent = transparentIndex >= 0

  // pass two: every frame mapped to the one palette
  const out = gif.GIFEncoder()
  for (let i = 0; i < count; i++) {
    const index = gif.applyPalette(frame(i), palette, format)
    // hundredths so that frame i ends at round((i + 1) * 100 / fps)
    const cs = Math.round(((i + 1) * 100) / fps) - Math.round((i * 100) / fps)
    out.writeFrame(index, size, size, {
      palette: i === 0 ? palette : undefined,
      delay: cs * 10,
      repeat: 0,
      transparent,
      transparentIndex: transparent ? transparentIndex : 0,
      // full frames: clear to transparent between them when there is alpha
      dispose: transparent ? 2 : 1,
    })
  }
  out.finish()
  return out.bytes()
}
