# @awflow/avatar-vue

Deterministic SVG avatars from a name, as a Vue component. Built on
[Peek](https://peek.doan-labs.com) by Doan Labs. Same input, same avatar, on
the server and the client.

Built on `@awflow/avatar`: the identity, the geometry and the live rig are the
shared core, rendered here through Vue.

## Install

```sh
npm install @awflow/avatar-vue @awflow/avatar vue
```

`vue` is a peer dependency (Vue 3.5 or newer, for `useId`).

## Usage

```vue
<script setup lang="ts">
import { Avatar, AvatarGroup } from '@awflow/avatar-vue'
</script>

<template>
  <Avatar name="Ada Lovelace" />
  <Avatar name="Linh" expression="happy" :size="128" />
  <Avatar name="Linh" animate gaze="pointer" />
</template>
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
- `class`, `style`: applied to the root `<svg>`. Other attributes are not
  forwarded: the core owns the svg's own attributes.

Internal SVG ids come from `useId`, so two identical avatars on one page never
share defs and the server and the client agree.

## Exposed methods

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Avatar, type AvatarExposed } from '@awflow/avatar-vue'

const ada = ref<AvatarExposed | null>(null)
const linh = ref<AvatarExposed | null>(null)

function cheer() {
  ada.value?.react('wink')
  ada.value?.pulse(0.5)
  ada.value?.setVoice(() => level) // lip-sync, 0..1
  ada.value?.lookAt(linh.value) // another avatar or an element
}
</script>

<template>
  <Avatar ref="ada" name="Ada" animate />
  <Avatar ref="linh" name="Linh" animate />
</template>
```

## Groups

```vue
<AvatarGroup speaker="Ada">
  <Avatar name="Ada" animate />
  <Avatar name="Linh" animate />
</AvatarGroup>
```

Everyone looks at the speaker; the speaker looks ahead. No wrapper element is
rendered.

## KeepAlive

Inside `<KeepAlive>`, a deactivated avatar stops its rig. When it is
activated again it re-adopts the same svg and catches up with any state
change made meanwhile.

## Plugins

Register the same plugins on the server and the client, before the first
render, so the server frame and the first live paint agree.

## Docs

Full documentation: <https://github.com/awflow/agent-avatar#readme>

## License

Built on Peek by Doan Labs. [MIT](./LICENSE) © Doan Labs, © AWFlow
