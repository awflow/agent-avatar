# @awflow/avatar

A name in, a face out. Deterministic SVG avatars. Built on [Peek](https://peek.doan-labs.com) by Doan Labs.

```sh
npm install @awflow/avatar
```

```js
import { toSvg } from '@awflow/avatar'

const svg = toSvg('Linh', { size: 96, expression: 'happy' })
```

Full documentation: <https://github.com/awflow/agent-avatar#readme>

## Framework components

The core renders plain SVG and has no framework dependency. For components:

- React: [`@awflow/avatar-react`](https://www.npmjs.com/package/@awflow/avatar-react)
- Svelte: [`@awflow/avatar-svelte`](https://www.npmjs.com/package/@awflow/avatar-svelte)
- Vue: [`@awflow/avatar-vue`](https://www.npmjs.com/package/@awflow/avatar-vue)
- Solid: [`@awflow/avatar-solid`](https://www.npmjs.com/package/@awflow/avatar-solid)
- Custom elements: [`@awflow/avatar-element`](https://www.npmjs.com/package/@awflow/avatar-element)
- PNG, APNG, GIF and sprites: [`@awflow/avatar-export`](https://www.npmjs.com/package/@awflow/avatar-export)

## Wardrobe

Dress a face with independent slots and a held prop:

```js
toSvg('Linh', { eyewear: 'glasses', headwear: 'bow' })
toSvg('Linh', { eyewear: 'visor', headwear: 'wizard', prop: 'coffee' })
toSvg('Linh', { headwear: 'cap', neckwear: 'scarf', face: 'freckles' })
toSvg('Linh', { dress: true }) // let the name pick the wardrobe
```

Eyewear: `glasses`, `sunglasses`, `monocle`, `visor`, `patch`, `cateye`.
Headwear: `bow`, `cap`, `sprout`, `beanie`, `headphones`, `antenna`,
`crown`, `wizard`, `party`, `halo`, `beret`, `chef`. Neckwear: `tie`,
`bowtie`, `scarf`, `necklace`, `badge`. Face decor (`face`): `freckles`,
`mustache`, `bandaid`, `sticker`. Props: `magnifier`, `pencil`, `coffee`,
`bulb`, `book`, `wrench`. Every slot defaults to `none`, so existing
avatars stay unchanged. The framework components take the same options as
props.

## Plain SVG and identity entry points

The SVG and identity entry points have no runtime dependencies:

```js
import { toSvg } from '@awflow/avatar/svg'
import { identify } from '@awflow/avatar/identity'

const svg = toSvg('Linh', { size: 96, expression: 'happy' })
const identity = identify('Linh')
```

The root entry point also exports `toSvg` and `identify`.
The same normalized name and options produce the same SVG every time.

## Command line

```sh
npx @awflow/avatar Linh > linh.svg
npx @awflow/avatar Linh --theme bold --expression happy --framing full --size 200
printf 'Linh\nBao\nAda\n' | npx @awflow/avatar sheet - > team.svg
```

`awflow-avatar <name> [options]` prints the avatar's SVG on stdout.
`awflow-avatar sheet <file|->` reads names, one per line, and prints one SVG
grid. Options: `--theme`, `--shape`, `--expression`, `--activity`,
`--framing peek|full`, `--frame`, `--size`, `--dress`, and one flag per hashed
axis (`--eyes`, `--brows`, `--mouth`, `--cheeks`, `--trait`, `--motif`,
`--eyewear`, `--headwear`, `--neckwear`, `--decor`, `--color`). `--help` lists
the accepted values. A bad flag or value prints one line on stderr and exits 1.

Raster output needs the optional `@awflow/avatar-export` package, which
writes raw bytes to stdout:

```sh
npx @awflow/avatar-export Linh --png 256 > linh.png
awflow-avatar Linh --gif 128 --fps 12 --seconds 2 > linh.gif
awflow-avatar sheet names.txt --sprite --size 64 > team.png
```

Without it, `--png`, `--gif` and `--sprite` print
`Install @awflow/avatar-export for --png/--gif/--sprite` and exit 1. The CLI
runs on Node 20 or later and uses no dependencies.

## License

Built on Peek by Doan Labs. [MIT](./LICENSE) © Doan Labs, © AWFlow
