# @awflow/avatar

A name in, a face out. Deterministic SVG avatars. Built on [Peek](https://peek.doan-labs.com) by Doan Labs.

```sh
npm install @awflow/avatar
```

## Framework components

The core renders plain SVG and has no framework dependency. For components:

- React: [`@awflow/avatar-react`](../avatar-react)
- Svelte: [`@awflow/avatar-svelte`](../avatar-svelte)

```js
import { toSvg } from '@awflow/avatar'

const svg = toSvg('Linh', { size: 96, expression: 'happy' })
```

## Accessories

Dress a face with three independent slots:

```js
toSvg('Linh', { eyewear: 'glasses', headwear: 'bow' })
toSvg('Linh', { eyewear: 'sunglasses', headwear: 'sprout' })
toSvg('Linh', { headwear: 'cap', neckwear: 'tie' })
```

Eyewear: `none`, `glasses`, `sunglasses`. Headwear: `none`, `bow`, `cap`,
`sprout`. Neckwear: `none`, `tie`. All default to `none` at `peek@1`, so
existing avatars stay unchanged. Slots combine and work with every
expression, gaze and frame. The framework components take the same options
as props.

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


## License

[MIT](./LICENSE) © Doan Labs, © AWFlow

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
