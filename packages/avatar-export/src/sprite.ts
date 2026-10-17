/*
 * Sprite sheets: many avatars, one PNG, laid out left to right then top to
 * bottom, transparent between tiles.
 */
import { type AvatarOptions, toSvg } from '@awflow/avatar'
import { checkGap, checkSheet, checkSize, checkSprite } from './limits'
import { encodePng } from './png'
import { ensure, rgba } from './raster'

export type SpriteSettings = {
  /** Each tile's side in pixels, 1 to LIMITS.maxSize. Default 256. */
  size?: number
  /** Tiles per row, 1 to LIMITS.maxSprite. Default ceil(sqrt(names)). */
  columns?: number
  /** Transparent pixels between tiles, 0 to LIMITS.maxSize. Default 0. */
  gap?: number
}

/**
 * The names as one PNG grid, `columns` tiles wide: width is columns * size +
 * (columns - 1) * gap, height likewise for the rows used. The same options
 * apply to every tile. The sheet's area is at most LIMITS.maxSheet pixels. Name i sits at column i % columns, row i / columns.
 */
export async function toSprite(
  names: string[],
  opts: AvatarOptions = {},
  o: SpriteSettings = {},
): Promise<Uint8Array> {
  const fn = 'toSprite()'
  const columns = checkSprite(fn, names, o.columns)
  const size = checkSize(fn, o.size)
  const gap = checkGap(fn, o.gap)
  const rows = Math.ceil(names.length / columns)
  const w = columns * size + (columns - 1) * gap
  const h = rows * size + (rows - 1) * gap
  checkSheet(fn, w, h)
  await ensure()
  const sheet = new Uint8Array(w * h * 4)
  names.forEach((name, i) => {
    const tile = rgba(toSvg(name, opts), size)
    const x = (i % columns) * (size + gap)
    const y = Math.floor(i / columns) * (size + gap)
    for (let r = 0; r < size; r++)
      sheet.set(
        tile.subarray(r * size * 4, (r + 1) * size * 4),
        ((y + r) * w + x) * 4,
      )
  })
  return encodePng(sheet, w, h)
}
