# Plan 1 — Foundation & identity v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A git repo in `awflow-agant-avatar/` containing Peek's core and Svelte adapter renamed to `@awflow/avatar*`, extended with themes and identity v2 (15 shapes, new parts, motifs, 12 colour slots, opt-in wardrobe hashing), while `peek@1` stays byte-identical.

**Architecture:** Peek's pipeline is kept: `identify(name) → settle(name, opts) → draw(who, pose, opts) → serialize/Live`. Themes enter as a `DrawOptions.theme`; identity v2 is `VERSIONS[2]` over append-only lists; new anchors are added to `FaceGeom`. Nothing in the drawing tree changes for `version: 1` + `theme: 'soft'`.

**Tech Stack:** Bun 1.4, Turborepo 2, Biome 2, TypeScript 6, `bun:test` (core), vitest + svelte 5 (svelte adapter).

**Spec:** `docs/superpowers/specs/2026-10-17-awflow-avatar-design.md` (§5, §7.1–7.3, §7.6 LOD/ring, §8 compat)

## Global Constraints

- See roadmap "Shared global constraints"; all apply.
- Source of truth for the import: `/Users/dannickstark/Documents/GitHub/peek` at commit `0f5c4ff9565e698167c5108341bb6ab8ff3ab441`.
- Package names: `@awflow/avatar` (core, dir `packages/avatar`), `@awflow/avatar-svelte` (dir `packages/avatar-svelte`), `@awflow/typescript-config` (dir `packages/typescript-config`). Package version `0.0.0` until Plan 6.
- The internal style name stays `'peek'` and the hashed axis key for the body silhouette stays `'face'` (renaming either would move every hash). Public option `shape` maps onto it.
- Generated SVG ids keep the prefix `peek-` when `version === 1` and use `awf-` when `version >= 2`.
- `LATEST = 2`.

## Review Focus

1. **Peek habits under v2** — a caller passing `face: 'circle'` (Peek's meaning) to a v2 avatar must not crash or draw garbage; expected: `face` is a decoration slot in v2, unknown values are ignored and the hashed decoration stays. Test in Task 4.
2. **Hex colours from users** — `color: '#ABC'`, `'#aabbcc'`, `'red'`, `'#zzzzzz'`; expected: 3/6-digit hex accepted (case-insensitive), anything else ignored (hashed colour kept), never `NaN` in the SVG. Test in Task 2.
3. **Empty / whitespace / emoji / RTL names** under v2 — `''`, `'   '`, `'Zoë 🙂'`, `'مريم'`; expected: a valid, deterministic SVG. Test in Task 3.
4. **Two avatars of the same name but different themes on one page** — ids must differ (themes change the drawing). Test in Task 2.
5. **Tiny sizes** — `size: 12` and `size: 0`; expected: LOD 0 output with no `NaN`/`Infinity`, and stroke ramp doesn't divide by zero. Test in Task 8.

---

### Task 1: Repository scaffold and Peek import

**Files:**
- Create: `package.json`, `turbo.json`, `biome.json`, `.gitignore`, `LICENSE`, `README.md`, `AGENTS.md` (+ `CLAUDE.md` symlink → `AGENTS.md`)
- Create (copied from Peek): `packages/typescript-config/**`, `packages/avatar/**` (from `packages/peek`, excluding `dist`, `.turbo`, `.DS_Store`), `packages/avatar-svelte/**` (from `packages/peek-svelte`, excluding `dist`, `.svelte-kit`, `.turbo`, `.DS_Store`)
- Modify: every `package.json`, import specifier and tsconfig `extends` that names `@doan-labs/peek`, `@doan-labs/peek-svelte` or `@peek/typescript-config`
- Test: `packages/avatar/src/peek.test.ts` (existing, unchanged assertions), `packages/avatar-svelte/src/peek.svelte.test.ts`

**Interfaces:**
- Produces: workspace with `bun run test`, `bun run build`, `bun run check-types`, `bun run lint` at the root (turbo pipelines for `test` added next to Peek's `build`/`check-types`/`dev`).
- Produces: core entry `@awflow/avatar` and subpaths `./adapter`, `./svg`, `./identity` (same files as Peek).
- Renames in this task (public API): component `Peek` → `Avatar` (`src/peek.tsx` → `src/avatar.tsx`, `PeekProps` → `AvatarProps`), `PeekOptions` → `AvatarOptions`; Svelte `Peek` → `Avatar` (`peek.svelte` → `avatar.svelte`). Rename test files to `avatar.test.ts` / `avatar.svelte.test.ts`.

- [ ] **Step 1:** `git init` in `awflow-agant-avatar/`; copy the files listed above; root `package.json` mirrors Peek's (name `awflow-avatar`, private, workspaces `["apps/*", "packages/*"]`, scripts `dev|build|check-types|test|format|lint`), without Peek's `deploy` script. `.gitignore` = Peek's. `biome.json` = Peek's minus the `peek.html` ignore.
- [ ] **Step 2:** `LICENSE`: MIT with two lines `Copyright (c) 2026 Doan Labs` (keep Peek's exact line) and `Copyright (c) 2026 AWFlow`. `README.md`: one paragraph + install line + "Built on [Peek](https://peek.doan-labs.com) by Doan Labs". `AGENTS.md`: Peek's "Rules" and "Motion" sections adapted (library deterministic; pure SVG, no runtime deps; always "Doan Labs"), plus the global constraints of this plan.
- [ ] **Step 3:** Apply the renames listed in Interfaces; update `src/index.ts` exports accordingly; in `scripts/build.ts` keep the four entry points.
- [ ] **Step 4:** Run `bun install && bun run test`. Expected: all Peek tests pass, including `golden svg at peek@1` with the unchanged inline snapshot (`"Ada Lovelace": "iy6qf3"`, `"Linh": "l6lya4"`, `"Đoàn": "1qvkegk"`, `"東京": "c3eobf"`), and the svelte SSR-parity tests.
- [ ] **Step 5:** Run `bun run build && bun run check-types && bun run lint`. Expected: exit 0.
- [ ] **Step 6:** Commit the spec + plans + import: `git add -A && git commit -m "chore: import Peek 1.2.0 (0f5c4ff) as @awflow/avatar"` — the message body names the source repo, commit and MIT licence.

### Task 2: Themes and 12 colour slots

**Files:**
- Create: `packages/avatar/src/themes.ts`
- Modify: `packages/avatar/src/tables.ts` (COLORS append), `src/draw.ts` (read colours/inks from theme), `src/svg.ts` (`theme`, hex `color`), `src/index.ts`, `src/adapter.ts`
- Test: `packages/avatar/src/themes.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Ink = { body: string; deep: string }
  export type Theme = {
    name: string
    frame: string                      // default frame fill (Peek's frame option still overrides)
    colors: Record<Color, Ink>         // all 12 slots
    ink: (c: Ink) => string            // features
    sclera: (c: Ink) => string
    pupil: (c: Ink) => string
    motifs: boolean                    // hash motifs when true
    motifInk: (c: Ink) => string
    motifOpacity: number
    shading: 'flat' | 'bold' | 'clay'
    outline: null | { color: (c: Ink) => string; width: number; glow: boolean }
  }
  export const THEMES: Record<'soft' | 'bold' | 'mono' | 'neon' | 'clay', Theme>
  export function defineTheme(t: Theme): Theme           // registers by name
  export function themeOf(name?: string): Theme          // unknown → soft
  export function parseHex(s: string): string | null     // '#abc' | '#aabbcc' (any case) → '#aabbcc'; else null
  export function deepOf(hex: string): string            // darken 25% toward black, per channel, rounded
  ```
- `DrawOptions` gains `theme: Theme` and `ink?: Ink` (resolved colour); `AvatarOptions` gains `theme?: string` and `color?: Color | \`#${string}\``.
- `Color` list (append-only): `lavender, fog, clay, mint, butter, rose, aqua` (Peek) + `peach, sky, sage, sand, plum`.

- [ ] **Step 1: Write the failing tests** in `themes.test.ts`:
  - `soft theme keeps peek@1 bytes`: for the 4 golden names × 11 expressions × sizes [48, 300], `toSvg(name, {expression, size, version: 1, theme: 'soft'})` equals `toSvg(name, {expression, size, version: 1})`, and the golden snapshot test still passes.
  - `every theme draws every colour clean`: for each theme in `THEMES` and each of the 12 colours, `toSvg('Linh', {theme, color, version: 2})` has no `NaN|Infinity|undefined`.
  - `hex colours`: `parseHex('#ABC') === '#aabbcc'`, `parseHex('#aabbcc') === '#aabbcc'`, `parseHex('red') === null`, `parseHex('#zzzzzz') === null`; `toSvg('Linh', {color: '#4f86f7'})` contains `#4f86f7`; `toSvg('Linh', {color: 'red' as any})` equals `toSvg('Linh')`.
  - `themes change ids`: the `id` prefix of `toSvg('Linh', {theme: 'soft'})` ≠ that of `toSvg('Linh', {theme: 'bold'})`.
  - `defineTheme registers`: after `defineTheme({...THEMES.soft, name: 'test'})`, `themeOf('test').name === 'test'`; `themeOf('nope') === THEMES.soft`.
- [ ] **Step 2:** Run `bun test src/themes.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `themes.ts`** with these built-ins (values from the mocks):
  - `soft`: Peek's 7 inks + `peach {#F6D3B8,#E8B08A}`, `sky {#C9E2F5,#9EC6E8}`, `sage {#DCE5C8,#B9CA98}`, `sand {#E8DCCB,#CDB99C}`, `plum {#E2CFE6,#C7A7CF}`; frame `INK.ink`; ink/pupil `INK.ink`; sclera `INK.paper`; motifs false; motifInk = deep; motifOpacity 0.55; shading flat; outline null.
  - `bold`: slots in list order = AWFlow `['#5fb3a1','#f0a54a','#5b5bd6','#8b5cf6','#4f86f7','#ea7a3f','#e5677a','#7cb342','#e0b83c','#6b7280','#c084fc','#2dd4bf']`, deep = `deepOf`; frame `INK.bone`; ink/pupil `#1C1714`; sclera `#FFFFFF`; motifs true; motifInk `#FFFFFF`; motifOpacity 0.3; shading bold.
  - `mono`: every body `INK.paper`, deeps cycle `['#F3D9C8','#D8E3F0','#DCEBD9','#EADCF2','#F2E6B8','#F2D3DC']`; frame bone; ink/pupil `INK.ink`; sclera paper; motifs true; motifInk ink; opacity 0.12; outline `{color: ink, width: 7.5, glow: false}` (340-unit space).
  - `neon`: pairs cycle `[['#1E1733','#B57BFF'],['#0F2730','#3EE6F0'],['#16260F','#9BF24A'],['#2E1324','#FF5FB0'],['#2C2010','#FFB547'],['#121E36','#5C9CFF']]`; frame `#0D0E13`; ink = sclera = deep; pupil `#0D0E13`; motifs true; motifInk deep; opacity 0.22; outline `{color: deep, width: 6, glow: true}`.
  - `clay`: `[['#F28C6B','#C9573A'],['#7DB7E8','#4C86BE'],['#9CD08A','#5F9E4F'],['#F5C451','#C9952A'],['#C39BE8','#8E62BF'],['#F49AC1','#C9628F'],['#6FD3C4','#36A091'],['#B8B2A7','#857F75'],['#E8836F','#B44F3C'],['#8FA8F0','#5A73C2'],['#E9A86A','#B9773B'],['#A8C9E0','#6F98B5']]`; frame `#EFE9DF`; ink/pupil `#2A211C`; sclera white; motifs false; shading clay.
- [ ] **Step 4:** In `draw.ts` replace direct `COLORS[who.color]` / `INK` reads with `o.ink ?? o.theme.colors[who.color]` and the theme's ink/sclera/pupil functions; Peek's `frame` option keeps precedence (`'ink'|'bone'|'paper'|'none'` map to Peek's fills), and a new `frame: 'theme'` value (the default when `theme` is given and `frame` is not) uses `theme.frame`. In `settle()` resolve `theme` (default `soft`), `ink` from `parseHex(color)` + `deepOf`, and include the theme name and ink in the id hash input **only when not soft/default** so v1 ids stay identical.
- [ ] **Step 5:** Run `bun test`. Expected: PASS, golden v1 snapshot unchanged.
- [ ] **Step 6:** Commit `feat(core): themes and 12 colour slots`.

### Task 3: Identity v2 — lists, versions, motif and decoration axes, `dress`

**Files:**
- Modify: `packages/avatar/src/tables.ts`, `src/identity.ts`
- Test: `packages/avatar/src/identity-v2.test.ts`

**Interfaces:**
- Produces (lists, append-only, in this order):
  - `FACES` keys: `diamond, semicircle, circle, triangle, cube, drop, gem, cloud, ghost, peak, blob, capsule, bean, arch, flower` (geometry for the 11 new ones lands in Task 5; until then they may alias `circle` geometry)
  - `PARTS.eyes`: `oval, bead, ring, pill, dot, spark` · `brows`: `arch, bar, wedge, dash, none` · `mouth`: `poly, round, line, box, cat, none` · `cheeks`: `oval, dots, lines, none` · `trait`: `square, fin, ring, dot, peak, none`
  - new `PARTS.motif`: `plain, dots, stripes, waves, grid, speckle, glow, rays`
  - `ACCESSORIES.headwear`: Peek's + `beanie, headphones, antenna, crown, wizard, party, halo, beret, chef` · `eyewear`: Peek's + `monocle, visor, patch, cateye` · `neckwear`: Peek's + `bowtie, scarf, necklace, badge` · new `ACCESSORIES.decor`: `none, freckles, mustache, bandaid, sticker` (drawings land in Plan 3; until then non-Peek items draw nothing)
  - `VERSIONS[2] = { face: 15, color: 12, eyes: 6, brows: 4, mouth: 5, cheeks: 3, trait: 5, motif: 7, eyewear: 1, headwear: 1, neckwear: 1, decor: 1 }`; `VERSIONS[1]` gains `motif: 1, decor: 1` (so v1 always picks `plain`/`none`); `LATEST = 2`.
  - `Axes` gains `motif: Motif` and `decor: Decor`; `Identity` unchanged otherwise.
  - `identify(name, { version?, dress? }): Identity` — with `dress: true` and `version >= 2`, each wardrobe slot uses its own seed `dress:<slot>`: `seed % 100 < odds` picks `LIST[1 + (seed >>> 8) % (LIST.length - 1)]`, else `'none'`; odds headwear 45, eyewear 25, neckwear 20, decor 20. `dress` is ignored under v1.
  - Motif: `identify` always hashes motif under v2; the *theme* decides whether to draw it (`settle` sets `who.motif = 'plain'` when `!theme.motifs` and no explicit `motif`).

- [ ] **Step 1: Write the failing tests:**
  - `v1 lists are pinned`: for 200 generated names, `identify(n, {version: 1})` equals the Peek-era result (`motif: 'plain'`, `decor: 'none'`, and every other axis within Peek's original list lengths); the `golden identities at peek@1` test from Peek still passes unchanged.
  - `v2 picks from the whole lists`: across 2000 names, every one of the 15 faces, 12 colours, 6 eyes, 4 brows (never `none`), 5 mouths (never `none`), 3 cheeks, 5 traits and 7 motifs (never `rays`) appears at least once.
  - `dress odds`: across 4000 names with `dress: true`, the share of non-`none` headwear is within 45% ± 3, eyewear 25% ± 3, neckwear and decor 20% ± 3; without `dress`, all four are `'none'`.
  - `odd names`: for `''`, `'   '`, `'Zoë 🙂'`, `'مريم'`, `toSvg(name)` is deterministic across two calls and free of `NaN|Infinity|undefined`.
  - `golden identities at peek@2`: inline snapshot of `identify(n)` for `['Ada Lovelace', 'Linh', 'Đoàn', '東京']` (record on first run, then frozen).
- [ ] **Step 2:** Run `bun test src/identity-v2.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the list/version changes in `tables.ts` and `identify()` changes in `identity.ts` (persona draw order unchanged).
- [ ] **Step 4:** Peek tests that relied on "unpinned = v1" get an explicit `version: 1`; their expected values must not change. Run `bun test`. Expected: PASS; record the v2 inline snapshot; v1 golden snapshots unchanged.
- [ ] **Step 5:** Commit `feat(core): identity v2 lists, motif + decor axes, dress`.

### Task 4: Public option mapping (`shape`, `face`, `style`, `prop`)

**Files:**
- Modify: `packages/avatar/src/svg.ts` (`AvatarOptions`, `settle`)
- Test: `packages/avatar/src/options.test.ts`

**Interfaces:**
- Produces `AvatarOptions` (all optional): `shape?: Face`, `face?: Decor` (v2) — under `version: 1` `face` keeps Peek's meaning (silhouette), `style?: 'peek@1' | 'peek@2'` (sets `version`; `version` wins if both), `motif?: Motif`, `dress?: boolean`, `prop?: Prop` (list `none, magnifier, pencil, coffee, bulb, book, wrench`; never hashed; drawn in Plan 3), plus Task 2's `theme`/`color`.
- `settle()` returns `who` with `face` = silhouette, `decor`, `motif`, `prop`; unknown values for any axis keep the hashed value (Peek's `wear()` rule generalised to every axis).

- [ ] **Step 1: Write the failing tests:**
  - `shape overrides the silhouette`: `settle('Linh', {shape: 'cube'}).who.face === 'cube'`.
  - `face is a decoration in v2`: `settle('Linh', {face: 'freckles'}).who.decor === 'freckles'`; `settle('Linh', {face: 'circle' as any}).who.decor === identify('Linh').decor` and the silhouette is unchanged.
  - `face keeps Peek's meaning in v1`: `settle('Linh', {version: 1, face: 'circle'}).who.face === 'circle'`.
  - `style pins the version`: `toSvg('Linh', {style: 'peek@1'}) === toSvg('Linh', {version: 1})`.
  - `unknown values are ignored`: for each axis, passing `'nope'` yields the same `who[axis]` as no override.
  - `id prefix`: `toSvg('Linh', {version: 1})` contains `id="peek-`; `toSvg('Linh')` contains `id="awf-`.
- [ ] **Step 2:** Run `bun test src/options.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement in `settle()`.
- [ ] **Step 4:** Run `bun test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(core): shape/face/style/prop options`.

### Task 5: Eleven new shapes and the extra anchors

**Files:**
- Modify: `packages/avatar/src/tables.ts` (`FaceGeom`, `FACES`), `src/draw.ts` (only where anchors are read)
- Test: `packages/avatar/src/shapes.test.ts`

**Interfaces:**
- `FaceGeom` gains `hw: number` (head half-width at the crown, hat scale = `clamp(hw / 88, 0.55, 1.2)`), `side: number` (half-width at the eye line), `neck: number` (y of the neckwear line). Add them to Peek's 4 faces too (circle `hw 88, side 150`, semicircle `hw 102, side 160`, diamond `hw 30, side 133`, triangle `hw 20, side 95`; `neck = mouth.y + 25` for all).
- New `FACES` entries in Peek's 340-unit space. Starting values are the mock prototype's (100-unit) anchors × 3.4 — `ey` eye line, `dx` eye offset from x=50, `rx/ry` eye radii, `by` brow line, `my` mouth y, `cx/cy` cheek offset/y, `top/bottom`, `side`, `hw`, `tr` trait seat (x, y, normal°):

  | shape | body path (100 units) | ey | dx | rx | ry | by | my | cx | cy | top | bottom | side | hw |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | cube | `M30 6h40a24 24 0 0 1 24 24v40a24 24 0 0 1-24 24H30A24 24 0 0 1 6 70V30A24 24 0 0 1 30 6z` | 46 | 17 | 7.6 | 8.4 | 32 | 66 | 27 | 61 | 6 | 94 | 44 | 32 |
  | drop | `M50 4c13 17 38 32 38 53a38 38 0 0 1-76 0C12 36 37 21 50 4z` | 58 | 13 | 6.8 | 7.6 | 45 | 74 | 24 | 69 | 4 | 95 | 37 | 8 |
  | gem | `M41 9a13 13 0 0 1 18 0l32 32a13 13 0 0 1 0 18L59 91a13 13 0 0 1-18 0L9 59a13 13 0 0 1 0-18z` | 47 | 13 | 6.5 | 7.6 | 33 | 64 | 21 | 59 | 5 | 95 | 40 | 11 |
  | cloud | 8 arcs r15 between points on r36 about (50,50), first at −90° | 48 | 14 | 7 | 7.6 | 34 | 64 | 24 | 59 | 7 | 93 | 40 | 22 |
  | ghost | `M50 6C74 6 92 24 92 48V88L80 80L68 90L56 80L44 90L32 80L20 90L8 82V48C8 24 26 6 50 6Z` | 44 | 15 | 7.2 | 8 | 30 | 61 | 25 | 56 | 6 | 90 | 42 | 26 |
  | peak | `M42 12c4-7 12-7 16 0l36 66c4 8-1 16-10 16H16c-9 0-14-8-10-16z` | 64 | 11 | 6 | 7 | 52 | 77 | 22 | 73 | 7 | 94 | 30 | 7 |
  | blob | `M50 7C72 6 93 22 92 47C91 72 76 93 50 93C24 93 8 74 8 50C8 25 28 8 50 7Z` | 46 | 16 | 7.8 | 8.4 | 31 | 65 | 26 | 60 | 7 | 93 | 42 | 25 |
  | capsule | `M50 4a28 28 0 0 1 28 28v36a28 28 0 0 1-56 0V32A28 28 0 0 1 50 4z` | 40 | 11 | 5.8 | 6.6 | 28 | 56 | 18 | 51 | 4 | 96 | 28 | 20 |
  | bean | `M28 24h44a26 26 0 0 1 0 52H28a26 26 0 0 1 0-52z` | 46 | 18 | 7 | 7.4 | 34 | 61 | 31 | 57 | 24 | 76 | 48 | 32 |
  | arch | `M14 92V48a36 36 0 0 1 72 0v44z` (round joins 5) | 50 | 15 | 7 | 8 | 36 | 68 | 24 | 63 | 12 | 92 | 36 | 24 |
  | flower | 6 large arcs r15 between points on r28, first at −60° | 48 | 13 | 6.6 | 7.2 | 35 | 63 | 22 | 58 | 6 | 94 | 40 | 14 |

  Fill the remaining Peek fields: `eyes = [[(50-dx)·3.4, ey·3.4], [(50+dx)·3.4, ey·3.4]]`, `pr = 0.52·rx·3.4`, `brow = {y: by·3.4, hw: 0.95·rx·3.4, arch: 15, w: 5.62}`, `cheeks = [[(50∓cx)·3.4, cy·3.4]]`, `crx 11.25, cry 5.62`, `mouth = {x: 170, y: my·3.4, w: 16, d: 16.25, sw: 4.38}`, `sink` = 30 when `top·3.4 < 51` else 0, and `crown` = the convex hull of the body outline above the eye line (poly clockwise from the top, `r` = the corner radius where the outline is round). Tune visually against the mock "Shapes" board; numbers are frozen when Plan 6 publishes.

- [ ] **Step 1: Write the failing tests:**
  - `every shape has finite anchors`: for each face, all numeric fields of `FACES[face]` are finite; `crown.poly.length >= 1`; `seat(crown, 0, 0)` and `ringWalk(FACES[face])` are finite.
  - `eyes sit inside the body`: for each face, both eye centres lie inside the body (use the face's crown polygon grown by `r` as the inside test for convex shapes; for cloud/flower/ghost test against the bounding box `[top, bottom]` and `±side`).
  - Peek's existing tests `every face x part x expression draws clean` and `brows never leave the face` now iterate the 15 faces via `LISTS.face` and must pass.
- [ ] **Step 2:** Run `bun test src/shapes.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Add the geometry; render each new shape at 300 px with `bun scripts/banner.ts`-style output (add `scripts/sheet.ts` that writes `scratch/shapes.svg` with all 15 × 3 expressions) and adjust anchors until faces read correctly.
- [ ] **Step 4:** Run `bun test`. Expected: PASS; v1 golden unchanged.
- [ ] **Step 5:** Commit `feat(core): eleven new shapes with anchors`.

### Task 6: New face parts — pill/dot/spark eyes, `none` brows/mouth/cheeks/trait, cat mouth

**Files:**
- Modify: `packages/avatar/src/draw.ts` (eye, brow, mouth, cheek, trait sections)
- Test: `packages/avatar/src/parts.test.ts`

**Interfaces:**
- Consumes: Task 3 lists. Every new part reads the same channels as Peek's parts so all 11 expressions read on it (lids/lower lid clip non-sclera eyes; `lower > 0.3 && lid < 0.25` draws a happy arc; closed eyes draw a curve).
- Drawing references (prototype, 100-unit, scale ×3.4): pill = capsule `w = 0.42·rx`, `h = 0.9·ry`, offset by gaze ×0.3; dot = circle `0.42·rx`; spark = ellipse `0.48·rx × 0.72·ry` + shine `0.2·rx` + second shine `0.09·rx`; cat = two quadratic arcs `M-hw,0 Q-hw/2,k 0,0 Q hw/2,k hw,0` with an inner ellipse when open; `none` draws nothing (and the live tree keeps no node for it).

- [ ] **Step 1: Write the failing tests:**
  - `new parts draw on every face and expression`: for each of `pill, dot, spark` × 15 faces × 11 expressions, `toSvg` is clean; same for mouth `cat`.
  - `none removes the part`: `toSvg('Linh', {brows: 'none'})` contains no node keyed `brow`; same for `mouth`, `cheeks`, `trait` (assert on `draw()` tree keys).
  - `live tree is stable across poses for new parts`: Peek's `a live tree keeps its structure across poses` test extended to `eyes: pill|dot|spark` and `mouth: cat`.
- [ ] **Step 2:** Run `bun test src/parts.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the part drawings in `draw.ts` next to Peek's, keyed `eyes.L/R.*`, `mouth.*`, etc., following Peek's node-key conventions.
- [ ] **Step 4:** Run `bun test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(core): pill, dot, spark eyes; cat mouth; none parts`.

### Task 7: Motifs and theme shading/outline

**Files:**
- Modify: `packages/avatar/src/draw.ts`
- Test: `packages/avatar/src/motifs.test.ts`

**Interfaces:**
- Consumes: `Theme.motifInk/motifOpacity/shading/outline` (Task 2), `who.motif` (Task 3).
- Motifs are drawn inside a `clipPath` of the body (`${id}-b`), above the body fill, below features. Patterns (100-unit prototype ×3.4): dots grid step 12 r 1.9 (offset rows); stripes 4-wide bands every 10 at 45°; waves rows every 10, `q5 -5 10 0` repeated, stroke 2; grid lines every 12, stroke 1.2; speckle 34 dots seeded by `fnv1a(key + 'sp')`; glow two white ellipses top-left (op 0.32, 0.3); rays 12 wedges ±6° from the centre, white op 0.24.
- Shading: `bold` = black ellipse op 0.1 over the lower 42% (clipped); `clay` = deep-colour ellipse bottom-right op 0.45 + white highlight ellipse op 0.42 + small specular op 0.7 (clipped), and a contact shadow under the body when `framing: 'full'` (added in Task 8). `outline` = body stroke in `outline.color(ink)` at `outline.width`; with `glow` an extra 3.5× wider stroke at op 0.18 behind the body.

- [ ] **Step 1: Write the failing tests:**
  - `motifs draw clipped`: for each motif, `toSvg('Linh', {theme: 'bold', motif})` contains `clip-path="url(#…-b)"` (except `plain`) and is clean.
  - `soft hides hashed motifs`: for 200 names, `settle(n, {theme: 'soft'}).who.motif === 'plain'`; `settle(n, {theme: 'soft', motif: 'dots'}).who.motif === 'dots'`.
  - `shading per theme`: `bold`, `clay`, `mono`, `neon` outputs each contain their shading/outline node keys (`shade.*`, `outline`, `outline.glow`).
- [ ] **Step 2:** Run `bun test src/motifs.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `bun test`. Expected: PASS; v1 golden unchanged.
- [ ] **Step 5:** Commit `feat(core): motifs and theme shading`.

### Task 8: Level of detail, ring and framing

**Files:**
- Modify: `packages/avatar/src/draw.ts`, `src/svg.ts`
- Test: `packages/avatar/src/lod.test.ts`

**Interfaces:**
- `DrawOptions` gains `ring: null | { color: string; progress?: number; pulse?: boolean }` (drawn as a circle/arc at r = 190 on the frame, stroke 12; progress 0..1 draws an arc from 12 o'clock clockwise; `pulse` is animated in Plan 2 — static opacity 1).
- `AvatarOptions`/`DrawOptions` gain `framing: 'peek' | 'full'` (default `'peek'` = Peek's floor-cropped portrait, unchanged). `'full'` wraps everything drawn in body space (body, parts, wardrobe) in `translate(170 170) scale(0.8) translate(-170 -c)` with `c = ((top − 48) + bottom) / 2` in frame units, so the whole body plus hat head-room is centred; with `frame: 'none'` the root `<svg>` gets `overflow="visible"` and no frame clip. Clay's contact shadow (Task 7) is drawn only in `'full'`.
- LOD is derived from `size`: `< 24` → body + eyes only (no brows, cheeks, mouth, trait, motif, wardrobe, prop); `< 44` → no brows, cheeks, trait, prop (FX rules land in Plan 2); else full. Under `version: 1` LOD is **off** (byte identity) unless `lod: true` is passed.

- [ ] **Step 1: Write the failing tests:**
  - `lod tiers`: `draw()` tree for `size: 16` has no `brow`, `mouth`, `cheek`, `trait` keys; `size: 32` has `mouth` but no `brow`/`cheek`/`trait`; `size: 96` has all.
  - `tiny sizes stay finite`: `toSvg('Linh', {size: 12})` and `toSvg('Linh', {size: 0})` contain no `NaN|Infinity`.
  - `ring`: `toSvg('Linh', {ring: {color: '#F08A24', progress: 0.62}})` contains a ring node with stroke `#F08A24`; `progress: 0` and `1` are finite.
  - `v1 untouched`: golden v1 snapshot still passes.
  - `full framing`: for all 15 faces, `framing: 'full'` puts the body's bounding box (top − 48 … bottom, scaled) inside the 340 frame; `frame: 'none'` + `'full'` yields `overflow="visible"` and no `${id}-f` clip use; clay + full contains `shade.contact`.
- [ ] **Step 2:** Run `bun test src/lod.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `bun test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(core): level of detail, presence ring, full framing`.

### Task 9: Compat subpath — `fromLegacy`, `lookForRole`, `ARIA`

**Files:**
- Create: `packages/avatar/src/compat.ts`; add `./compat` to `package.json#exports` and `scripts/build.ts` entries
- Test: `packages/avatar/src/compat.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type LegacyAvatar = { icon?: string; color: string; shape?: string; motif?: string; eyes?: string; acc?: string }
  export function fromLegacy(av: LegacyAvatar): AvatarOptions
  export function lookForRole(text: string): AvatarOptions   // ports agentic-flow look.ts ROLE_LOOKS regexes
  export const ARIA: AvatarOptions
  ```
- `fromLegacy` mapping: `theme: 'bold'`; shape `pebble→circle`, `cube|peak|drop|gem|cloud|ghost` same name, missing → omitted (hash decides); `color` = the stored hex; `motif` = stored unless `rays`/missing → `'plain'`; eyes `pills→pill, dots→dot, round→oval, sleepy→bead, spark→spark`, missing → `pill`; `acc: glasses → eyewear 'glasses'`, `beanie|headphones|antenna|bow → headwear` same name; `brows, mouth, cheeks, trait: 'none'`.
- `ARIA = { theme: 'bold', shape: 'circle', color: '#f08a24', motif: 'rays', eyes: 'pill', brows: 'none', mouth: 'line', cheeks: 'oval', trait: 'none' }`.
- `lookForRole` ports the 9 regex → look pairs from `agentic-flow/src/lib/assistant/agents/look.ts` (`ROLE_LOOKS`), translated with the same mapping as `fromLegacy`; no match → `{}`.

- [ ] **Step 1: Write the failing tests:** each mapping row above as one assertion; `lookForRole('Plan my trip to Lisbon')` returns `{shape: 'drop', color: '#4f86f7', motif: 'dots', headwear: 'headphones', …}`; `lookForRole('zzz')` → `{}`; `toSvg('Aria', ARIA)` is clean and contains `#f08a24`.
- [ ] **Step 2:** Run `bun test src/compat.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `bun test && bun run build && bun run check-types`. Expected: PASS / exit 0.
- [ ] **Step 5:** Commit `feat(core): compat helpers for AWFlow looks`.
