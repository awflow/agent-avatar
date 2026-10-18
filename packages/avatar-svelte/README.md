# @awflow/avatar-svelte

Deterministic SVG avatars from a name, as a Svelte 5 component. Built on
[Peek](https://peek.doan-labs.com) by Doan Labs. Same input, same avatar, on the server and the client.

Built on `@awflow/avatar`: the identity, the geometry and the live rig are the
shared core, rendered here through Svelte.

## Install

```sh
npm install @awflow/avatar-svelte @awflow/avatar svelte
```

`svelte` is a peer dependency (Svelte 5.20 or later, for `$props.id()`).

## Usage

```svelte
<script>
  import { Avatar } from '@awflow/avatar-svelte'
</script>

<Avatar name="Ada Lovelace" />
<Avatar name="Linh" expression="happy" size={128} />
<Avatar name="Linh" animate gaze="pointer" />
```

## Props

- `name` (required): the string the avatar is derived from.
- `animate`: bring the face to life after mount. Off under
  prefers-reduced-motion. Default false.
- `gaze`: `[x, y]` in -1..1 for a fixed look, or `"pointer"` to follow the
  pointer (animate only).
- `expression`, `size`, `frame`, `square`, `riso`, `title`, `version`, the
  identity axes (`face`, `color`, `eyes`, `brows`, `mouth`, `cheeks`, `trait`)
  and the wardrobe slots (`eyewear`, `headwear`, `neckwear`): everything
  `@awflow/avatar`'s options accept, passed straight through.
- `class`, `style`: applied to the root `<svg>`.

## Ids

Each `<Avatar>` gets its own SVG ids from `$props.id()`, the same on the
server and the client, so two identical avatars on one page never share a
clip path or gradient. There is no `id` prop.

## Imperative API

Bind the component (`bind:this={avatar}`) to call:

- `react(name)`, `pulse(strength?)`, `setVoice(fn | null)`: animated only.
- `lookAt(target)`: another `<Avatar>` instance, a handle, an element, or
  `null` to look ahead.
- `getHandle()`: the core handle once mounted, `null` before.
- `getElement()`: the `<svg>` showing the avatar, `null` before mount.

## Docs

Full documentation: <https://awflow.github.io/agent-avatar/>

## License

Built on Peek by Doan Labs. [MIT](./LICENSE) © Doan Labs, © AWFlow
