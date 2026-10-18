# @awflow/avatar-react

Deterministic SVG avatars from a name, as a React component. Built on
[Peek](https://peek.doan-labs.com) by Doan Labs. Same input, same avatar, on
the server and the client.

Built on `@awflow/avatar`: the identity, the geometry and the live rig are the
shared core, rendered here through React.

## Install

```sh
npm install @awflow/avatar-react @awflow/avatar react
```

`react` is a peer dependency (React 18 or newer).

## Usage

```tsx
import { Avatar, AvatarGroup, type AvatarRef } from '@awflow/avatar-react'

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
- `expression`, `activity`, `ring`: state. They change the avatar in place
  and never re-render the svg.
- `reaction` and `reactKey`: plays `reaction` each time `reactKey` changes
  after mount.
- `size`, `theme`, `version`, `framing`, `frame`, `square`, `fx`, `dress`,
  `riso`, `title`, the identity axes and the wardrobe slots: everything
  `@awflow/avatar`'s options accept, passed straight through. Pin a drawing
  version with `version`.
- `className`, `style`: applied to the root `<svg>`.

Internal SVG ids come from `useId`, so two identical avatars on one page never
share defs and the server and the client agree.

## Imperative handle

```tsx
const ref = useRef<AvatarRef>(null)

<Avatar ref={ref} name="Ada" animate />

ref.current?.react('wink')
ref.current?.pulse(0.5)
ref.current?.setVoice(() => level) // lip-sync, 0..1
ref.current?.lookAt(otherRef.current) // another avatar or an element
```

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

## Docs

Full documentation: <https://awflow.github.io/agent-avatar/>

## License

Built on Peek by Doan Labs. [MIT](./LICENSE) © Doan Labs, © AWFlow
