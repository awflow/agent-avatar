# Changelog

All seven packages share one version.

## 1.0.0 (2026-10-18)

Built on Peek by Doan Labs (MIT), extended by AWFlow. The first release of `@awflow/avatar`, `@awflow/avatar-export`,
`@awflow/avatar-svelte`, `@awflow/avatar-react`, `@awflow/avatar-vue`,
`@awflow/avatar-solid` and `@awflow/avatar-element`.

### Core (`@awflow/avatar`)

- A name in, a deterministic SVG out: the same input renders the same bytes
  on the server and the client. No runtime dependencies.
- Style versions: `peek@1` is byte-identical to `@doan-labs/peek` 1.2.0
  (`toSvg(name, { style: 'peek@1' })` or `version: 1`); version 2 is the
  default and is frozen by a golden test, so a released name never changes.
- Identity v2: 15 face shapes, eyes, brows, mouths (pill, dot and spark eyes,
  a cat mouth, `none` parts), cheeks, traits, motifs and face decor, with
  `dress` letting the name pick the wardrobe too.
- Five themes (`soft`, `bold`, `mono`, `neon`, `clay`) over 12 colour slots,
  theme shading, `defineTheme` for your own.
- Wardrobe: 12 headwear items (some with physics), 6 eyewear, 5 neckwear,
  4 face decorations and 6 held props, placed beside the face on every
  shape and frame.
- 11 expressions, 10 activities blended with them (idle, listening,
  thinking, working, speaking, waiting, done, error, sleeping, offline),
  an FX layer, 10 reactions (`nod` to `celebrate`), lip-sync hooks, gaze
  and group gaze.
- `mount()` and `attach()`: a framework-free live handle on one shared rAF
  loop, DOM attribute writes only, paused off-screen; `prefers-reduced-motion`
  cuts durations, never the pose.
- Level of detail by size, a presence ring, `peek` and `full` framing, round
  or square frames.
- A plugin API (shapes, accessories, props, FX, themes) and an `ai` entry
  with a look schema and a prompt helper; `compat` helpers for saved AWFlow
  looks.
- A pure `Rig` and `frames()` for deterministic animation without a DOM.
- The `awflow-avatar` CLI: SVG for a name or a sheet of names, Node 20+, no
  dependencies; raster flags delegate to `@awflow/avatar-export`.

### Export (`@awflow/avatar-export`)

- `toPng`, `toApng`, `toGif` and `toSprite` in Node and the browser,
  rasterised by resvg compiled to WebAssembly: the same input gives the same
  bytes everywhere.
- Named limits instead of exhausted memory: 600 frames, 1024 px, a sprite
  pixel budget.
- The `awflow-avatar-export` CLI.

### Components

- React (`'use client'`, SSR safe), Svelte 5, Vue 3.5 and Solid components
  with the same props as the core options, an imperative handle and an
  `AvatarGroup` for shared gaze and a speaker.
- `<awf-avatar>` and `<awf-avatar-group>` custom elements, light DOM, no
  framework.
- Solid consumers get JSX-preserving source through the `solid` export
  condition, compiled by the app's own Solid plugin.

### Docs

- A docs and playground site, with every snippet typechecked against the
  published types, and `/llms.txt`.
