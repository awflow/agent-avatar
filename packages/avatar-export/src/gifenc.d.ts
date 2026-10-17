// gifenc 1.0.3 ships no types: the part of its API this package uses.
declare module 'gifenc' {
  export type Palette = number[][]
  export type Format = 'rgb565' | 'rgb444' | 'rgba4444'
  export interface Encoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: Palette
        delay?: number
        repeat?: number
        transparent?: boolean
        transparentIndex?: number
        dispose?: number
      },
    ): void
    finish(): void
    bytes(): Uint8Array
  }
  export function GIFEncoder(): Encoder
  export function quantize(
    rgba: Uint8Array,
    maxColors: number,
    options?: {
      format?: Format
      oneBitAlpha?: boolean | number
      clearAlpha?: boolean
    },
  ): Palette
  export function applyPalette(
    rgba: Uint8Array,
    palette: Palette,
    format?: Format,
  ): Uint8Array
}
