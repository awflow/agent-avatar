# @awflow/avatar

A string in, a face out. Deterministic SVG avatars from a name: the same input
renders the same bytes on the server and the client, so an avatar never needs
storing, only its name.

- Pure SVG with zero runtime dependencies in the core.
- 15 shapes, 5 themes, 11 expressions, 10 agent activities, 10 reactions, a
  wardrobe of headwear, eyewear, neckwear, face decor and held props.
- A spring-driven live rig for animation, on one shared `requestAnimationFrame`
  loop that writes DOM attributes only and pauses off-screen.
- Components for React, Svelte, Vue and Solid, an `<awf-avatar>` custom
  element, PNG, APNG, GIF and sprite export, and a CLI.

Built on [Peek](https://peek.doan-labs.com) by Doan Labs.

Docs and playground: <https://awflow.github.io/agent-avatar/>

## Packages

| Package | For | Install |
| --- | --- | --- |
| [`@awflow/avatar`](packages/avatar) | the core: `toSvg`, `mount`, plugins, the CLI | `npm install @awflow/avatar` |
| [`@awflow/avatar-react`](packages/avatar-react) | React 18 or later | `npm install @awflow/avatar-react @awflow/avatar react` |
| [`@awflow/avatar-svelte`](packages/avatar-svelte) | Svelte 5.20 or later | `npm install @awflow/avatar-svelte @awflow/avatar svelte` |
| [`@awflow/avatar-vue`](packages/avatar-vue) | Vue 3.5 or later | `npm install @awflow/avatar-vue @awflow/avatar vue` |
| [`@awflow/avatar-solid`](packages/avatar-solid) | Solid 1.9 or later | `npm install @awflow/avatar-solid @awflow/avatar solid-js` |
| [`@awflow/avatar-element`](packages/avatar-element) | any page: `<awf-avatar>` | `npm install @awflow/avatar-element @awflow/avatar` |
| [`@awflow/avatar-export`](packages/avatar-export) | PNG, APNG, GIF, sprite sheets | `npm install @awflow/avatar-export @awflow/avatar` |

Every package is ESM with TypeScript declarations. Each adapter renders the
core's own SVG, so a server render equals `toSvg` for the same input (only the
svg id prefix differs, unique per component). The CLIs and the export package
need Node 20 or later.

## Quick start

### Plain SVG

```js
import { toSvg } from '@awflow/avatar'

const svg = toSvg('Linh') // a 64 px avatar, as an SVG string
const big = toSvg('Ada Lovelace', {
  size: 128,
  theme: 'bold',
  expression: 'happy',
  activity: 'working',
})
```

`@awflow/avatar/svg` and `@awflow/avatar/identity` are smaller entry points for
just `toSvg` and `identify`.

### A live avatar without a framework

```js
import { mount } from '@awflow/avatar'

const avatar = mount(document.querySelector('#me'), {
  name: 'Linh',
  animate: true,
  activity: 'thinking',
})
avatar.set({ activity: 'done' })
avatar.react('celebrate')
avatar.destroy()
```

### React

```tsx
import { Avatar } from '@awflow/avatar-react'

export const Me = () => <Avatar name="Linh" expression="happy" size={96} animate />
```

Svelte, Vue and Solid take the same props (`<Avatar name="Linh" />`); see
each package's README.

### Custom element

```html
<script type="module">
  import '@awflow/avatar-element' // defines <awf-avatar> and <awf-avatar-group>
</script>

<awf-avatar name="Linh" expression="happy" size="96" animate></awf-avatar>
```

### Command line

```sh
npx @awflow/avatar Linh > linh.svg
npx @awflow/avatar Linh --theme bold --expression happy --framing full --size 200
printf 'Linh\nBao\nAda\n' | npx @awflow/avatar sheet - > team.svg
npx @awflow/avatar --help
```

### PNG, GIF and sprite sheets

```sh
npx @awflow/avatar-export Linh --png 256 > linh.png
npx @awflow/avatar-export Linh --gif 128 --fps 12 --seconds 2 > linh.gif
npx @awflow/avatar-export sheet names.txt --sprite --size 64 > team.png
```

```ts
import { toGif, toPng, toSprite } from '@awflow/avatar-export'

const png = await toPng('Linh', { expression: 'happy' }, { size: 512 })
const gif = await toGif('Linh', { reaction: 'hop' }, { fps: 24, seconds: 2 })
const sheet = await toSprite(['Ada', 'Linh', 'Sam'], {}, { size: 64 })
```

In the browser, call `init` with the resvg wasm first; see the
[export README](packages/avatar-export/README.md).

## What a face is made of

| Option | Values |
| --- | --- |
| `theme` | `soft` (default), `bold`, `mono`, `neon`, `clay`, or your own with `defineTheme` |
| `shape` | `diamond` `semicircle` `circle` `triangle` `cube` `drop` `gem` `cloud` `ghost` `peak` `blob` `capsule` `bean` `arch` `flower` |
| `expression` | `normal` `happy` `sad` `angry` `sleepy` `curious` `surprised` `excited` `confused` `bored` `attentive` |
| `activity` | `idle` `listening` `thinking` `working` `speaking` `waiting` `done` `error` `sleeping` `offline` |
| reactions | `nod` `shake` `wink` `hop` `spin` `shiver` `gasp` `love` `giggle` `celebrate` |
| `framing` · `frame` | `peek` `full` · `ink` `bone` `paper` `none` `theme` |
| wardrobe | `headwear`, `eyewear`, `neckwear`, `decor`, `prop`; `dress: true` lets the name pick |

Everything not set is derived from the name: shape, colour, eyes, brows, mouth,
cheeks, trait and motif. Any of them can be overridden one at a time. Pin a
drawing with `version` (`1` is byte-identical to Peek 1.2.0, `2` is the
default); a released version never changes the face of an existing name.

Plugins add shapes, accessories, props, FX and themes (`defineShape`,
`defineAccessory`, `defineProp`, `defineFx`, `defineTheme`).
`@awflow/avatar/ai` gives a model a schema and a prompt to describe a look in
words; `@awflow/avatar/compat` reads saved AWFlow looks.

## Links

- Docs and playground: <https://awflow.github.io/agent-avatar/>
- Core and options: [packages/avatar](packages/avatar/README.md)
- Adapters: [React](packages/avatar-react/README.md) ·
  [Svelte](packages/avatar-svelte/README.md) ·
  [Vue](packages/avatar-vue/README.md) ·
  [Solid](packages/avatar-solid/README.md) ·
  [custom element](packages/avatar-element/README.md)
- Export and CLI: [packages/avatar-export](packages/avatar-export/README.md)
- [Changelog](CHANGELOG.md)
- npm: [`@awflow/avatar`](https://www.npmjs.com/package/@awflow/avatar)

## Working on it

```sh
bun install
bun run build
bun run check-types
bun run test
bun run lint
bun scripts/release.ts   # pack, check and smoke the tarballs; never publishes
```

## Credits and licence

Built on Peek by Doan Labs (MIT), extended by AWFlow.
[MIT](LICENSE) © Doan Labs, © AWFlow. `@awflow/avatar-export` rasterises with
[resvg](https://github.com/linebender/resvg) (MPL-2.0).
