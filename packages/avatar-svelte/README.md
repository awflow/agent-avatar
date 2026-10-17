# @awflow/avatar-svelte

Deterministic SVG avatars from a name, as a Svelte 5 component. Built on
[Peek](https://peek.doan-labs.com) by Doan Labs. Same input, same avatar, on the server and the client.

Built on `@awflow/avatar`: the identity, the geometry and the live rig are the
shared core, rendered here through Svelte.

## Install

```sh
npm install @awflow/avatar-svelte @awflow/avatar svelte
```

`svelte` is an optional peer dependency (Svelte 5).

## Usage

```svelte
<script>
  import { Avatar } from '@awflow/avatar-svelte'
</script>

<Avatar name="Ada Lovelace" />
<Avatar name="Linh" expression="happy" size={128} />
<Avatar name="Doan Labs" animate gaze="pointer" />
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
- `id`: see below.

## The `id` prop

Each avatar's internal SVG ids are derived from a hash of everything drawn, so
they are stable across the server and the client and unique per distinct
avatar. If you render two byte-identical avatars (same `name` and the same
options) on one page, they would share those ids. Pass an explicit `id` to keep
them distinct:

```svelte
<Avatar name="Ada" id="hero" />
<Avatar name="Ada" id="footer" />
```

## License

MIT
