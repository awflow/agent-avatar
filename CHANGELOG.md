# Changelog

The seven packages started at one version (1.0.0) and are versioned
independently from there: a patch bumps only the packages whose published
files change.

## 1.1.0 (unreleased)

`@awflow/avatar` 1.1.0, `@awflow/avatar-export` 1.1.0,
`@awflow/avatar-vue` 1.1.0 and `@awflow/avatar-element` 1.1.0. The React,
Svelte and Solid adapters are unchanged at 1.0.0 (they forward every option,
`character` included) and accept core 1.1.0 through `^1.0.0`. No released
name changes its static face: the version 2 golden and the `peek@1` parity
tests hold byte for byte.

### Character plugins (`@awflow/avatar`)

- `defineCharacter({ name, geom, draw, eye?, brow?, mouth?, parts?,
  physics?, lift?, headroom? })`, registered with `registerPlugins` and
  picked with the new `character` option, never hashed. A character draws a
  whole mascot in body space (behind the body, the body, in front of the
  face) on the package's own rig: blinks, saccades, breathing, springs,
  activities, reactions and overlays stay the package's. Its geometry is a
  body shape's, so wardrobe, props, overlays and rings place on it. Plugin
  rules hold: keyed nodes, the same nodes every frame, a failing body falls
  back to the plain silhouette, server and client agree.
- The character context carries the activity, the size tier, breath, its own
  spring, the playing reaction and its progress, the activity it came from
  and how long ago (`activityWeight()` eases activity poses in and out), the
  altitude unit, the turning pivot and `tint`, the ink an explicit `color`
  asked for.
- A `focus` channel springs to 1 while thinking or working. It follows from
  the activity, so it never joins the id.
- `lift` scales how high a character hops; `headroom` tells `framing:
  'full'` how far its tallest part rises, and the frame keeps that, the
  highest hop and a whole spin in view.
- `FaceGeom.speech` places the speech waves; a character without one gets
  them beside its mouth, below its eyes. Built-in faces keep theirs.
- `frames()` takes a `timeline` of cues: an activity, an expression or a
  reaction at a time in seconds (at most `maxFrames` cues).
- `@awflow/avatar/ai` offers `character` only by registered character names,
  and only when at least one is registered; `parseLook` drops any other.

### Motion

- A spin turns about the body's centre instead of its feet, for every face:
  past 20 degrees of turn the pivot slides toward the centre, so a whole spin
  stays in place instead of swinging under the floor. Every static pose
  leans less than that, so static output is unchanged; a live spin or an
  exported spin GIF looks different.

### Export (`@awflow/avatar-export`)

- `toGif` and `toApng` take a `timeline` alongside `reaction`, and any
  options, a registered `character` included.
- `svgToPng(svg, { size })` rasterises an avatar SVG string (one starting with `<svg`), such as one frame of
  `frames()` or a sheet of them, within `maxSize` and `maxSheet`.

### Adapters

- `@awflow/avatar-vue` takes a `character` prop and `@awflow/avatar-element`
  a `character` attribute.

## 1.0.1 (2026-10-18)

`@awflow/avatar` 1.0.1, `@awflow/avatar-export` 1.0.1 and
`@awflow/avatar-element` 1.0.1. The React, Svelte, Vue and Solid adapters
are unchanged at 1.0.0 (their published files are unchanged) and accept core
1.0.1 through `^1.0.0`.

### Fixes

- `@awflow/avatar-element`: 1.0.0 shipped a 75-byte `dist/index.js` that
  called and exported `defineAvatarElements` without defining it, so the
  package failed to import. The bundler had honoured the dist-only
  `sideEffects` list on the sources and dropped `define.ts`. The element
  and export builds now bundle a staged copy of `src`, and every build fails
  when an entry exports a name it never defines. Importing in Node is safe
  again and defines nothing.
- CLI (`@awflow/avatar`): `sheet <file>` checks the file size before
  reading and `sheet -` reads stdin bounded: an input over 64 KiB is refused
  with one line naming the limit. `-h` and `-v` are aliases of `--help` and
  `--version`. `--fps` or `--seconds` without `--gif` is a one-line usage
  error instead of being ignored.
- `@awflow/avatar-export`: `toSprite` accepts `readonly string[]`.
- `engines: { node: ">=20" }` on `@awflow/avatar` and `@awflow/avatar-export`,
  whose bins need Node 20.

### Docs and tooling

- A full root README (packages, install per framework, examples, options).
- READMEs: CLI examples through `npx @awflow/avatar` and
  `npx @awflow/avatar-export`; the export browser setup installs
  `@resvg/resvg-wasm@2.6.2` explicitly, credits resvg (MPL-2.0) and notes the
  worst-case CPU time of large GIF and APNG exports on servers.
- `scripts/release.ts` installs the tarballs into a consumer and, under plain
  Node, imports every entry, checks every declared value export, renders the
  element under happy-dom and every adapter on the server against `toSvg`,
  and runs both bins. It packs every package but prints a publish command
  only for versions not yet on npm, and fails when an already published
  version would pack differently.
- CI: read-only token, Node 20 and 22, the core size file must stay as
  committed; core tests no longer leak live avatars across files.

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
