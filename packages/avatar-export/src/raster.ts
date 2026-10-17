/*
 * SVG to pixels through resvg compiled to WebAssembly: the same wasm, and so
 * the same bytes, in Node and in the browser. No system fonts are loaded
 * (avatars are pure shapes), so no machine's font set can change an image.
 */
import { initWasm, Resvg, type ResvgRenderOptions } from '@resvg/resvg-wasm'

/** What init() accepts: wasm bytes, a fetch() Response, or a URL to fetch. */
export type WasmSource =
  | ArrayBuffer
  | ArrayBufferView
  | Response
  | URL
  | WebAssembly.Module

let ready: Promise<void> | undefined

/**
 * Loads the resvg wasm once. Idempotent and safe to call concurrently: every
 * caller shares one in-flight promise, and a failed load can be retried.
 * In Node (and Bun or Deno) a call without an argument loads the wasm bundled
 * in `@resvg/resvg-wasm`; in a browser pass it, e.g. `init(fetch(wasmUrl))`.
 */
export function init(
  wasm?: WasmSource | PromiseLike<WasmSource>,
): Promise<void> {
  ready ??= load(wasm).catch((error: unknown) => {
    ready = undefined
    throw error
  })
  return ready
}

/** The export functions wait on this: init() with no argument when needed. */
export const ensure = (): Promise<void> => ready ?? init()

async function load(given: WasmSource | PromiseLike<WasmSource> | undefined) {
  const bytes = await source(await given)
  try {
    await initWasm(bytes)
  } catch (error) {
    // the app already initialised resvg-wasm itself: the same module serves
    if (!/already initiali[sz]ed/i.test(String(error))) throw error
  }
}

async function source(
  wasm: WasmSource | undefined,
): Promise<BufferSource | WebAssembly.Module> {
  if (wasm === undefined) return bundled()
  if (wasm instanceof URL) return source(await fetch(wasm))
  if (wasm instanceof ArrayBuffer || ArrayBuffer.isView(wasm)) return wasm
  if (typeof (wasm as Response).arrayBuffer === 'function') {
    // read here: any fetch, any content type, the same bytes for initWasm
    const res = wasm as Response
    if (!res.ok)
      throw new Error(`init(): fetching the wasm failed with ${res.status}`)
    return res.arrayBuffer()
  }
  return wasm as WebAssembly.Module
}

async function bundled(): Promise<ArrayBuffer | Uint8Array> {
  const proc = (globalThis as { process?: { versions?: { node?: string } } })
    .process
  if (!proc?.versions?.node)
    throw new TypeError(
      'init(): in a browser pass the resvg wasm, e.g. init(fetch(wasmUrl)) with the URL of @resvg/resvg-wasm/index_bg.wasm',
    )
  // kept out of reach of browser bundlers: only Node-like runtimes get here
  const load = (id: string) =>
    import(/* @vite-ignore */ /* webpackIgnore: true */ id)
  const { createRequire } = (await load('node:module')) as {
    createRequire(from: string): { resolve(id: string): string }
  }
  const { readFile } = (await load('node:fs/promises')) as {
    readFile(path: string): Promise<Uint8Array>
  }
  const path = createRequire(import.meta.url).resolve(
    '@resvg/resvg-wasm/index_bg.wasm',
  )
  return new Uint8Array(await readFile(path))
}

const options = (size: number): ResvgRenderOptions => ({
  fitTo: { mode: 'width', value: size },
  font: { loadSystemFonts: false },
})

/** One SVG as a PNG, size pixels wide, encoded by resvg. */
export function png(svg: string, size: number): Uint8Array {
  const resvg = new Resvg(svg, options(size))
  const image = resvg.render()
  try {
    return image.asPng()
  } finally {
    image.free()
    resvg.free()
  }
}

/**
 * One SVG as straight (not premultiplied) RGBA pixels, size by size. resvg
 * hands premultiplied pixels back; they are demultiplied the way its own PNG
 * encoder does it, so a tile reads as the PNG of the same avatar would.
 */
export function rgba(svg: string, size: number): Uint8Array {
  const resvg = new Resvg(svg, options(size))
  const image = resvg.render()
  try {
    const px = image.pixels.slice()
    if (image.width !== size || image.height !== size)
      throw new Error(
        `rasterising gave ${image.width}x${image.height}, expected ${size}x${size}`,
      )
    for (let i = 0; i < px.length; i += 4) {
      const a = px[i + 3]!
      if (a === 255 || a === 0) continue
      px[i] = Math.round((px[i]! * 255) / a)
      px[i + 1] = Math.round((px[i + 1]! * 255) / a)
      px[i + 2] = Math.round((px[i + 2]! * 255) / a)
    }
    return px
  } finally {
    image.free()
    resvg.free()
  }
}
