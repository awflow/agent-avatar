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
toSvg('Linh', { headwear: 'cap', neckwear: 'scarf', decor: 'freckles' })
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

## Plugins

Register shapes, wardrobe items, props, overlays, themes and characters at
runtime with `registerPlugins([...])`, on the server and the client, before
the first render. A plugin is reachable only through an explicit option
(`shape: 'squircle'`, `headwear: 'cat-ears'`, `character: 'my-mascot'`), never
through the hash, so a name keeps its face whatever is registered. Built-in
names cannot be replaced. Every plugin node lands under `plugin.<name>.*`; a
drawing that throws or yields non-finite numbers is skipped for that render
and reported once.

| Kind | Define with | Selected by |
| --- | --- | --- |
| Body shape | `defineShape({ name, geom })` | `shape` |
| Accessory | `defineAccessory({ slot, name, draw, physics? })` | `headwear`, `eyewear`, `neckwear`, `decor` |
| Held prop | `defineProp({ name, draw })` | `prop` |
| Overlay | `defineFx({ name, shapes })` | `fx` |
| Theme | `defineTheme({ name, ... })` | `theme` |
| Character | `defineCharacter({ name, geom, draw, ... })` | `character` |

### Characters

A character is a whole mascot drawn on the package's own rig: blinks,
saccades, breathing, springs, activity poses, reactions and overlays all stay
the package's, and the character turns them into shapes.

```js
import { defineCharacter, el, registerPlugins, toSvg } from '@awflow/avatar'

const mascot = defineCharacter({
  name: 'my-mascot',
  geom, // a FaceGeom: the anchors wardrobe, props, overlays and rings use
  physics: { stiffness: 9, damping: 0.3, maxSwing: 18 }, // optional own spring
  parts: { brows: 'none' }, // optional: pin built-in parts
  draw: (c) => ({
    defs: [], // gradients and clip paths, ids prefixed with c.id
    back: [], // behind the body
    body: [el('path', 'shell', { d: '...', fill: c.ink.body })],
    front: [], // over the face, under the wardrobe
  }),
  eye: (c, eye) => [/* drawn about the eye centre */],
  brow: (c, brow) => [/* drawn at the brow, already tilted */],
  mouth: (c, mouth) => [/* drawn at the mouth, already skewed */],
})
registerPlugins([mascot])
toSvg('Aria', { character: 'my-mascot', framing: 'full' })
```

- `geom` is checked as a shape's geometry is and stored frozen. The rig, the
  wardrobe, held props and overlays all place by it.
- `draw(ctx)` gets everything a wardrobe drawing gets (`pose`, `g(channel)`
  with the persona applied, the clock `t`, `theme`, `ink`, `id`, `size`)
  plus `activity`, `expression`, `tier` (2, 1 below 44px, 0 below 24px),
  `line` (the theme's feature ink), `breath` (-1..1), `swing` (its own
  spring, else the body swing), `lag`, and the `reaction` playing with its
  progress `reactionP`.
- `eye`, `brow` and `mouth` are optional. Left out, the built-in part draws
  on the character's anchors (pinned by `parts`, else picked by the name).
  An eye gets its final lid (blink and wink included), lower lid, tilt,
  pupil, shine, gaze and a `happy` 0..1 for a smiling arc.
- The `focus` channel springs to 1 while thinking or working and back to 0
  otherwise: drive anything that should slide in and out with it. For a pose
  tied to one activity, `activityWeight(ctx, 'waiting')` eases from 0 to 1
  as it begins and back as the next one takes over (`ctx.from`,
  `ctx.since`).
- Return the same nodes every frame and per tier, never per pose: a live
  avatar keeps its node set. Round your numbers (two decimals) so every
  engine writes the same bytes.
- Unknown names draw the avatar as without a character. A failing body draws
  the geometry's plain silhouette instead, so the avatar never vanishes.

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
npx @awflow/avatar sheet names.txt --size 64 > team.svg
```

`npx @awflow/avatar <name> [options]` prints the avatar's SVG on stdout.
`npx @awflow/avatar sheet <file|->` reads names, one per line (at most 400
names and 64 KiB; a larger input is refused before it is read), and prints one
SVG grid. Options: `--theme`, `--shape`, `--expression`, `--activity`,
`--framing peek|full`, `--frame`, `--size`, `--dress`, and one flag per hashed
axis (`--eyes`, `--brows`, `--mouth`, `--cheeks`, `--trait`, `--motif`,
`--eyewear`, `--headwear`, `--neckwear`, `--decor`, `--color`). `-h` or
`--help` lists the accepted values, `-v` or `--version` prints the version. A
bad flag or value prints one line on stderr and exits 1.

Raster output needs the optional `@awflow/avatar-export` package, which
writes raw bytes to stdout. Run it through that package's own command:

```sh
npx @awflow/avatar-export Linh --png 256 > linh.png
npx @awflow/avatar-export Linh --gif 128 --fps 12 --seconds 2 > linh.gif
npx @awflow/avatar-export sheet names.txt --sprite --size 64 > team.png
```

`--fps` and `--seconds` apply to `--gif` only. Where `@awflow/avatar-export`
is not installed, `--png`, `--gif` and `--sprite` print
`Install @awflow/avatar-export for --png/--gif/--sprite` and exit 1. The CLI
runs on Node 20 or later and uses no dependencies.

## License

Built on Peek by Doan Labs. [MIT](./LICENSE) © Doan Labs, © AWFlow
