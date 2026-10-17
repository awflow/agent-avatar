/*
 * What an export renders at most, and the checks that hold every request to
 * it. Every check runs before any pixel is drawn, and every failure is a
 * RangeError that names the limit it hit.
 */
import { FRAME_LIMITS } from '@awflow/avatar'

/**
 * The export caps: `maxFrames` is the core's own (FRAME_LIMITS, one source of
 * truth), `maxSize` bounds the side of an image in pixels, `maxSprite` the
 * number of names on one sheet and `maxSheet` a sheet's area in pixels
 * (4096 squared).
 */
export const LIMITS = Object.freeze({
  maxFrames: FRAME_LIMITS.maxFrames,
  maxSize: 1024,
  maxSprite: 400,
  maxSheet: 16_777_216,
})

export const DEFAULTS = Object.freeze({ size: 256, fps: 24, seconds: 2 })

/** A whole number from `min` to the named limit, or the default. */
function whole(
  fn: string,
  what: string,
  value: number | undefined,
  fallback: number,
  min: number,
  limit: keyof typeof LIMITS,
): number {
  if (value === undefined) return fallback
  const max = LIMITS[limit]
  if (!Number.isInteger(value) || value < min || value > max)
    throw new RangeError(
      `${fn}: ${what} ${value} must be a whole number from ${min} to ${limit} ${max}`,
    )
  return value
}

export const checkSize = (fn: string, size: number | undefined) =>
  whole(fn, 'size', size, DEFAULTS.size, 1, 'maxSize')

/** Tile gap in pixels: 0 up to maxSize. */
export const checkGap = (fn: string, gap: number | undefined) =>
  whole(fn, 'gap', gap, 0, 0, 'maxSize')

/** A sprite sheet's names and columns. */
export function checkSprite(
  fn: string,
  names: readonly string[],
  columns: number | undefined,
): number {
  const n = names.length
  if (n < 1 || n > LIMITS.maxSprite)
    throw new RangeError(
      `${fn}: ${n} names must be from 1 to maxSprite ${LIMITS.maxSprite}`,
    )
  return whole(fn, 'columns', columns, Math.ceil(Math.sqrt(n)), 1, 'maxSprite')
}

/**
 * fps and seconds against FRAME_LIMITS, then the frame count round(fps *
 * seconds) against maxFrames, all before rendering.
 */
export function checkTiming(
  fn: string,
  o: { fps?: number; seconds?: number },
): { fps: number; seconds: number; count: number } {
  const L = FRAME_LIMITS
  const fps = o.fps ?? DEFAULTS.fps
  const seconds = o.seconds ?? DEFAULTS.seconds
  if (!Number.isFinite(fps))
    throw new RangeError(
      `${fn}: fps ${fps} must be a finite number from minFps ${L.minFps} to maxFps ${L.maxFps}`,
    )
  if (fps < L.minFps)
    throw new RangeError(`${fn}: fps ${fps} is below minFps ${L.minFps}`)
  if (fps > L.maxFps)
    throw new RangeError(`${fn}: fps ${fps} is above maxFps ${L.maxFps}`)
  if (!Number.isFinite(seconds) || seconds <= 0)
    throw new RangeError(
      `${fn}: seconds ${seconds} must be a finite number above 0, up to maxSeconds ${L.maxSeconds}`,
    )
  if (seconds > L.maxSeconds)
    throw new RangeError(
      `${fn}: seconds ${seconds} is above maxSeconds ${L.maxSeconds}`,
    )
  const count = Math.round(fps * seconds)
  if (count > LIMITS.maxFrames)
    throw new RangeError(
      `${fn}: ${count} frames is above maxFrames ${LIMITS.maxFrames}`,
    )
  if (count < 1)
    throw new RangeError(
      `${fn}: fps ${fps} for ${seconds} seconds rounds to 0 frames, at least 1 is needed`,
    )
  return { fps, seconds, count }
}

/** A sprite sheet's area, w * h, against maxSheet, before any allocation. */
export function checkSheet(fn: string, w: number, h: number) {
  if (w * h > LIMITS.maxSheet)
    throw new RangeError(
      `${fn}: a ${w}x${h} sheet is ${w * h} pixels, above maxSheet ${LIMITS.maxSheet}`,
    )
}
