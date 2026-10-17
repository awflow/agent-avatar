# @awflow/avatar-export

AWFlow avatars as PNG, animated PNG, GIF and sprite sheets, in Node and the
browser. Rasterised by resvg compiled to WebAssembly, so the same name and
options give the same bytes on every machine. Built on Peek by Doan Labs.

```sh
npm install @awflow/avatar-export @awflow/avatar
```

## Use

Every function returns a `Promise<Uint8Array>`. In Node, Bun and Deno the
wasm loads on first use; nothing to set up.

```ts
import { toApng, toGif, toPng, toSprite } from '@awflow/avatar-export'

// a still PNG, 256 px square by default
const png = await toPng('Linh', { expression: 'happy' }, { size: 512 })

// an animated PNG: lossless, full alpha, 24 fps for 2 s by default
const apng = await toApng('Linh', { reaction: 'hop' }, { fps: 30, seconds: 3 })

// a GIF with one 256-colour palette, transparent where nothing is drawn
const gif = await toGif('Linh', { frame: 'none', activity: 'done' })

// many avatars on one sheet: 3 columns of 64 px tiles, 4 px apart
const sheet = await toSprite(['Ada', 'Linh', 'Sam'], {}, {
  size: 64,
  columns: 3,
  gap: 4,
})
```

Write the bytes anywhere: `await Bun.write('linh.png', png)`,
`fs.writeFileSync('linh.gif', gif)`, or
`URL.createObjectURL(new Blob([png], { type: 'image/png' }))`.

## Browsers

Load the wasm once with `init` before the first export. It takes a
`fetch()` response (or its promise), an `ArrayBuffer`, typed array or a `URL`:

```ts
import { init, toPng } from '@awflow/avatar-export'
import wasmUrl from '@resvg/resvg-wasm/index_bg.wasm?url' // Vite

await init(fetch(wasmUrl))
const png = await toPng('Linh')
```

`init` is idempotent: concurrent calls share one load, and later calls
return at once.

## Limits

`LIMITS` is
`{ maxFrames: 600, maxSize: 1024, maxSprite: 400, maxSheet: 16777216 }`, with
`maxFrames` taken from the core's `FRAME_LIMITS` (1 to 120 fps, up to 60
seconds). `maxSheet` caps a sprite sheet's area at 4096 by 4096 pixels. Frames are `round(fps * seconds)`, checked before anything is
drawn. A value out of range, or not a finite number, throws a `RangeError`
that names the limit.

GIF counts time in hundredths of a second and browsers slow down frames
shorter than 2/100 s, so keep GIFs at 50 fps or less. APNG timing is exact.

## Docs

Full documentation: <https://github.com/awflow/agent-avatar#readme>

## Credits

Built on Peek by Doan Labs (MIT). Rasterising by
[resvg](https://github.com/linebender/resvg), GIF encoding by
[gifenc](https://github.com/mattdesl/gifenc), compression by
[fflate](https://github.com/101arrowz/fflate).

[MIT](./LICENSE) © Doan Labs, © AWFlow
