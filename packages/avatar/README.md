# @awflow/avatar

A name in, a face out. Deterministic SVG avatars. Built on [Peek](https://peek.doan-labs.com) by Doan Labs.

```sh
npm install @awflow/avatar
```

## React 19

Install React 19 or newer in your app, then render a face:

```tsx
import { Avatar } from '@awflow/avatar'

<Avatar name='Linh' size={96} expression='happy' />
```

Use `animate` for blinking and expression transitions, and
`gaze='pointer'` to follow the pointer. Animation respects reduced motion.

## Accessories

Dress a face with three independent slots:

```tsx
<Avatar name='Linh' eyewear='glasses' headwear='bow' />
<Avatar name='Linh' eyewear='sunglasses' headwear='sprout' />
<Avatar name='Linh' headwear='cap' neckwear='tie' animate />
```

Eyewear: `none`, `glasses`, `sunglasses`. Headwear: `none`, `bow`, `cap`,
`sprout`. Neckwear: `none`, `tie`. All default to `none` at `peek@1`, so
existing avatars stay unchanged. Slots combine and work with every
expression, gaze and frame. The same options work with `toSvg`.

## Plain SVG, without React

The SVG and identity entry points have no runtime dependencies:

```js
import { toSvg } from '@awflow/avatar/svg'
import { identify } from '@awflow/avatar/identity'

const svg = toSvg('Linh', { size: 96, expression: 'happy' })
const identity = identify('Linh')
```

The root entry point also exports `toSvg` and `identify` for React apps.
The same normalized name and options produce the same SVG every time.


## License

[MIT](./LICENSE) © Doan Labs, © AWFlow
