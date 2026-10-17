# AWFlow Avatar

A public npm avatar library: a string in, a deterministic SVG out. Built on
Peek by Doan Labs (MIT) and extended. Turborepo on bun workspaces, Biome,
TypeScript. Packages: `packages/avatar` (`@awflow/avatar`, core),
`packages/avatar-svelte` (`@awflow/avatar-svelte`), `packages/typescript-config`.

`AGENTS.md` is canonical and `CLAUDE.md` is a symlink to it. Never replace
either with a real file.

## Rules

- **The library is deterministic.** The same input renders the same SVG, on
  the server and the client. `peek@1` output is byte-identical to
  `@doan-labs/peek` 1.2.0 (Peek commit `0f5c4ff9565e698167c5108341bb6ab8ff3ab441`).
- **Pure SVG, no runtime deps** in the core package. It never touches the DOM
  outside `animate.ts` and `mount.ts`.
- **Always "Doan Labs", never "Doan" alone**, in copy and in comments. Never use
  the Doan Labs name or mark as branding; credit "Built on Peek by Doan Labs".
- **Never an em dash**, in copy or in comments. Comma, colon, period or a
  middle dot.
- **Lists are append-only and ordered.** A change that alters an existing
  name's output under a released version needs a new version.
- The internal style name stays `'peek'` and the hashed body-silhouette axis
  key stays `'face'`. Generated SVG ids use the prefix `peek-` at version 1 and
  `awf-` at version 2 and later. `LATEST = 2`.
- No pushing or publishing until Plan 6.

## Motion

- One shared rAF loop, DOM attribute writes only, paused off-screen.
- Anything read every frame is a mutable object or a DOM write, never
  framework state.
- `prefers-reduced-motion` cuts durations to none, never the pose.

## Working here

```
bun install
bun run build
bun run check-types
bun run test
bun run lint
```

Core tests use `bun test`; framework adapters use vitest. Everything runs from
the root through `turbo run`. `biome.json` is the source of truth for style.
