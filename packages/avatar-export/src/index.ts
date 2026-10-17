/*
 * @awflow/avatar-export: avatars as PNG, APNG, GIF and sprite sheets, in
 * Node and the browser. Rasterised by resvg (WebAssembly), so the same input
 * gives the same bytes on every machine.
 */
import type { AvatarOptions } from '@awflow/avatar'
import { toSvg } from '@awflow/avatar'
import { checkSize } from './limits'
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
