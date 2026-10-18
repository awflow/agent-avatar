/*
 * @awflow/avatar-export: avatars as PNG, APNG, GIF and sprite sheets, in
 * Node and the browser. Rasterised by resvg (WebAssembly), so the same input
 * gives the same bytes on every machine.
 */
import type { AvatarOptions } from '@awflow/avatar'
import { toSvg } from '@awflow/avatar'
import { checkSize, LIMITS } from './limits'
import { ensure, png } from './raster'

export type {
  AnimatedOptions,
  AnimationSettings,
} from './animated'
export { toApng, toGif } from './animated'
export { DEFAULTS, LIMITS } from './limits'
export type { WasmSource } from './raster'
export { init } from './raster'
export type { SpriteSettings } from './sprite'
export { toSprite } from './sprite'

/**
 * Any avatar SVG (one frame of `frames()`, or a sheet of them) as a PNG,
 * `size` pixels wide (default 256, at most LIMITS.maxSize). The height
 * follows the SVG's aspect ratio.
 */
export async function svgToPng(
  svg: string,
  o: { size?: number } = {},
): Promise<Uint8Array> {
  const size = checkSize('svgToPng()', o.size)
  if (typeof svg !== 'string' || !svg.trimStart().startsWith('<svg'))
    throw new TypeError('svgToPng(): svg must be an SVG string')
  await ensure()
  return png(svg, size, LIMITS.maxSheet)
}

/** The avatar as a still PNG, `size` pixels square (default 256). */
export async function toPng(
  name: string,
  opts: AvatarOptions = {},
  o: { size?: number } = {},
): Promise<Uint8Array> {
  const size = checkSize('toPng()', o.size)
  await ensure()
  return png(toSvg(name, opts), size)
}
