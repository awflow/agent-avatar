# @awflow/avatar-solid

Deterministic SVG avatars from a name, as a Solid component. Built on
[Peek](https://peek.doan-labs.com) by Doan Labs. Same input, same avatar, on
the server and the client.

Built on `@awflow/avatar`: the identity, the geometry and the live rig are the
shared core, rendered here through Solid.

## Install

```sh
npm install @awflow/avatar-solid @awflow/avatar solid-js
```

`solid-js` is a peer dependency (1.9 or newer). The package ships a
hydratable DOM build and a server build, picked through the `browser` and
`node` export conditions, and its sources under the `solid` condition.

## Usage

```tsx
import { Avatar, AvatarGroup, type AvatarRef } from '@awflow/avatar-solid'

<Avatar name="Ada Lovelace" />
<Avatar name="Linh" expression="happy" size={128} />
<Avatar name="Doan Labs" animate gaze="pointer" />
```

Each avatar renders `<span style="display:contents">` around its `<svg>`.
The span takes no space in layout, so the svg sits in the flow as if it were
alone.

## Props

- `name` (required): the string the avatar is derived from.
- `animate`: bring the face to life after mount. Off under
  prefers-reduced-motion. Default false.
- `gaze`: `[x, y]` in -1..1 for a fixed look, or `"pointer"` to follow the
  pointer (animate only).
- `expression`, `activity`, `ring`: state. They change the avatar in place
  and keep the same svg.
- `reaction` and `reactKey`: plays `reaction` each time `reactKey` changes
  after mount.
- `size`, `theme`, `version`, `framing`, `frame`, `square`, `fx`, `dress`,
  `riso`, `title`, the identity axes and the wardrobe slots: everything
  `@awflow/avatar`'s options accept, passed straight through. Pin a drawing
  version with `version`.
- `class`, `style` (a string or an object): applied to the `<svg>`.

Internal SVG ids come from `createUniqueId`, so two identical avatars on one
page never share defs and the server and the client agree.

## Imperative handle

```tsx
let avatar!: AvatarRef

<Avatar ref={avatar} name="Ada" animate />

avatar.react('wink')
avatar.pulse(0.5)
avatar.setVoice(() => level) // lip-sync, 0..1
avatar.lookAt(other) // another avatar's ref, or an element
```

The ref is handed over once, when the component is created, and stays the
same object for the component's life, across identity changes.

## Groups

```tsx
<AvatarGroup speaker="Ada">
  <Avatar name="Ada" animate />
  <Avatar name="Linh" animate />
</AvatarGroup>
```

Everyone looks at the speaker; the speaker looks ahead. No wrapper element is
rendered.

## Plugins

Register the same plugins on the server and the client, before the first
render, so the server frame and the first live paint agree.

## License

MIT
