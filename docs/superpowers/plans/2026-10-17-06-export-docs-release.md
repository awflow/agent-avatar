# Plan 6 — Export, CLI, docs site & first release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raster/animated export and a CLI, a docs + playground site matching the mocks, and version 1.0.0 of every package published to npm.

**Architecture:** Animated export needs the rig without a DOM, so the stepping half of `Live` is extracted into a pure `Rig` (Live = Rig + DOM writer). `@awflow/avatar-export` turns `draw()` frames into PNG/APNG/GIF/sprite sheets with WASM resvg; the core ships a zero-dependency SVG-only CLI that delegates raster flags to the export package. The site is Peek's `apps/web` (TanStack Start on Cloudflare Workers) re-skinned and rewritten for `@awflow/avatar`.

**Tech Stack:** `@resvg/resvg-wasm`, `gifenc`, `upng-js` (export package only); TanStack Start + React 19 + `@awflow/avatar-react` (site); Cloudflare Workers static assets; npm.

**Spec:** `docs/superpowers/specs/2026-10-17-awflow-avatar-design.md` (§7.9 export, §9 bundle size, §10 step 7)

## Global Constraints

- Roadmap shared constraints apply; the core still has zero runtime dependencies (the CLI uses Node built-ins only).
- Exports are deterministic: same name + options + frame settings → identical bytes (no `Math.random` in `Rig` when a `seed` clock is used; `Live` keeps its randomness for blinks/saccades, `Rig` accepts an injectable `random: () => number`, default `mulberry32(seed('rig'))` in export).
- Lottie export is **not** in 1.0 (builder decision recorded here).
- The site never links to unfinished pages; docs content comes from one source file (Peek's `lib/docs.ts` pattern) that also builds `/llms.txt`.
- Publishing requires the owner to have created the npm org `awflow`; stop and ask if `npm org ls awflow` fails.

## Review Focus

1. **CLI with odd names and shells** — `npx @awflow/avatar ""`, names with quotes/emoji/RTL, `--size 0`, unknown flags; expected: valid SVG for odd names, clear error + exit 1 for invalid flags, never a stack trace. Test in Task 3.
2. **Export in Node and in the browser** — `toPng` must work in both (WASM init once); expected: same bytes. Test in Task 2.
3. **Huge exports** — `toGif` with `seconds: 60, fps: 60, size: 1024`; expected: refused with a clear limit error (max 600 frames, max 1024 px) instead of exhausting memory. Test in Task 2.
4. **Docs code samples drifting from the API** — expected: every code block in the docs source compiles against the published types. Test in Task 4 (typecheck snippets).
5. **Package contents** — published tarballs missing `dist` or shipping tests/sources; expected: `npm pack --dry-run` lists dist + README + LICENSE only (Svelte also `src` per Peek). Test in Task 5.

---

### Task 1: Pure `Rig` extracted from `Live`

> Executed as Plan 4 Task 0 (controller ruling). When running Plan 6, skip this task; its text stays here as the reference Plan 4 executes.

**Files:**
- Create: `packages/avatar/src/rig.ts`
- Modify: `src/animate.ts` (Live composes Rig), `src/index.ts`, `src/adapter.ts`
- Test: `packages/avatar/src/rig.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export class Rig {
    constructor(who: Drawable, opts: DrawOptions, state: { expression: Expression; activity: Activity; gaze?: Gaze }, random?: () => number)
    step(dt: number): void
    pose(): Pose
    setExpression(e: Expression): void
    setActivity(a: Activity): void
    setGaze(g: Gaze | null): void
    react(r: Reaction): void
    pulse(strength?: number): void
  }
  export function frames(name: string, opts: AvatarOptions & { reaction?: Reaction }, o: { fps: number; seconds: number }): string[]   // serialized SVG per frame, deterministic
  ```
- `Live` keeps its public API and behaviour (all Plan 2/4 tests stay green); pointer, IntersectionObserver, DOM writes and `lookAt` measurement stay in `Live`.

- [ ] **Step 1: Write the failing tests:** `frames('Linh', {activity: 'working'}, {fps: 10, seconds: 1})` returns 10 strings, identical across two calls; frames differ from each other; `Rig` with a reaction returns to the activity pose after the reaction's duration; Plan 2 `live.test.ts` unchanged and passing.
- [ ] **Step 2:** Run `bun test src/rig.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the extraction.
- [ ] **Step 4:** Run `bun test`. Expected: PASS.
- [ ] **Step 5:** Commit `refactor(core): pure Rig behind Live; deterministic frames()`.

### Task 2: `@awflow/avatar-export`

**Files:**
- Create: `packages/avatar-export/` (`src/index.ts`, `src/raster.ts`, `src/animated.ts`, `src/sprite.ts`, `package.json`, `tsconfig.json`)
- Test: `packages/avatar-export/src/export.test.ts` (`bun test`)

**Interfaces:**
- Produces:
  ```ts
  export function init(wasm?: ArrayBuffer | Response | URL): Promise<void>      // idempotent; Node loads the bundled wasm automatically
  export function toPng(name: string, opts?: AvatarOptions, o?: { size?: number }): Promise<Uint8Array>
  export function toApng(name: string, opts?: AvatarOptions & { reaction?: Reaction }, o?: { size?: number; fps?: number; seconds?: number }): Promise<Uint8Array>
  export function toGif(name: string, opts?: AvatarOptions & { reaction?: Reaction }, o?: { size?: number; fps?: number; seconds?: number }): Promise<Uint8Array>
  export function toSprite(names: string[], opts?: AvatarOptions, o?: { size?: number; columns?: number; gap?: number }): Promise<Uint8Array>
  export const LIMITS = { maxFrames: 600, maxSize: 1024, maxSprite: 400 }
  ```
- Defaults: size 256, fps 24, seconds 2. Exceeding `LIMITS` throws `RangeError` naming the limit. GIF uses a 256-colour palette quantised per animation (gifenc), transparent frame background when `frame: 'none'`.

- [ ] **Step 1: Write the failing tests:** `toPng('Linh')` starts with the PNG signature and decodes to 256×256; two calls are byte-identical; `toGif('Linh', {activity: 'done'}, {fps: 10, seconds: 1})` has 10 frames; `toSprite(['A','B','C'], {}, {size: 64, columns: 2})` decodes to 128+gap wide; `toGif(..., {seconds: 60, fps: 60})` throws `RangeError` mentioning `maxFrames`; a browser-like run (happy-dom + `init(fetch(wasmUrl))`) produces the same PNG bytes as Node.
- [ ] **Step 2:** Run `bun run --filter @awflow/avatar-export test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(export): PNG, APNG, GIF and sprite export`.

### Task 3: CLI

**Files:**
- Create: `packages/avatar/bin/awflow-avatar.mjs` (core: `bin: { "awflow-avatar": … }`), `packages/avatar-export/bin/awflow-avatar-export.mjs`
- Test: `packages/avatar/src/cli.test.ts`

**Interfaces:**
- Usage (core): `npx @awflow/avatar <name> [--theme t] [--shape s] [--expression e] [--activity a] [--size n] [--framing peek|full] [--frame f] [--dress] [--<axis> value]… [--png n | --gif n | --sprite]` → SVG on stdout; `sheet <file|->` reads names (one per line) and emits one SVG grid. Raster flags dynamically import `@awflow/avatar-export`; if missing, print `Install @awflow/avatar-export for --png/--gif/--sprite` and exit 1.
- Errors: unknown flag or invalid value → one-line message on stderr + exit 1; `--help` prints usage, exit 0.

- [ ] **Step 1: Write the failing tests** (spawn with `Bun.spawn`): `awflow-avatar Linh --theme bold` stdout equals `toSvg('Linh', {theme: 'bold'})`; `awflow-avatar ""` exits 0 with valid SVG; `--size 0` exits 0 with finite SVG; `--bogus` exits 1 with a one-line message and no stack; `--png 128` without the export package exits 1 with the install hint; with it, stdout begins with the PNG signature.
- [ ] **Step 2:** Run `bun test src/cli.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement (hand-written argv parsing, Node built-ins only).
- [ ] **Step 4:** Run tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(cli): awflow-avatar`.

### Task 4: Docs + playground site

**Files:**
- Create (copied from Peek, then rewritten): `apps/web/**` (excluding Peek-specific assets, `/studio` kept as the playground); root `wrangler.jsonc`
- Create: `apps/web/src/lib/docs.ts` content for: Home (hero with name input, live row across themes), Get started (7 framework tabs), Themes (+ `defineTheme`), Shapes & parts, Expressions & activities, Reactions & motion, Wardrobe & props, Plugins, Export & CLI, AI looks, Coming from Peek (`style="peek@1"`), Changelog; `/playground` (props per the Playground board, code tab per framework); `/llms.txt`, `/llms-full.txt`
- Create: `scripts/size.ts` (gzip size of `packages/avatar/dist/index.js` → `apps/web/src/generated/size.json`)
- Test: `apps/web` typecheck + a snippet check script `apps/web/scripts/check-snippets.ts`

**Interfaces:**
- Consumes `@awflow/avatar-react` for every live avatar on the site; all copy says "Built on Peek by Doan Labs" in the footer; branding is AWFlow (Geist, accent `#B45309`), never the Doan Labs mark.
- Footer size line reads `size.json` (replaces the mock's `[bundle size]` placeholder); domain placeholder `[docs domain]` in `wrangler.jsonc` routes until the owner picks one.

- [ ] **Step 1: Write the failing check:** `check-snippets.ts` extracts every fenced `ts`/`tsx`/`svelte` block tagged `check` from `docs.ts` into temp files and typechecks them against the workspace packages; initially fails (no content).
- [ ] **Step 2:** Run `bun apps/web/scripts/check-snippets.ts`. Expected: FAIL.
- [ ] **Step 3:** Import and rewrite the site per the mock boards "07 · Docs" and "05 · Playground"; prerender only listed pages (Peek's `vite.config.ts` rule).
- [ ] **Step 4:** Run `bun run build && bun apps/web/scripts/check-snippets.ts && bun scripts/size.ts`. Expected: exit 0; open the built site locally and walk every page.
- [ ] **Step 5:** Commit `feat(web): docs and playground site`.

### Task 5: Release 1.0.0

**Files:**
- Modify: every `packages/*/package.json` (version `1.0.0`, `repository`, `homepage`, `license: MIT`, `files`, `publishConfig: { access: 'public' }`), per-package `README.md` (install + one example + link to docs + Doan Labs credit)
- Create: `CHANGELOG.md`, `.github/workflows/ci.yml` (install, test, build, check-types, lint)
- Test: `npm pack --dry-run` per package

- [ ] **Step 0a:** Before freezing, settle the deferred cosmetics so frozen bytes are final: mustache mirrors with persona/face; round-semicircle prop no longer floats into the hat zone; visor handles non-level eyes; memoise per-`FaceGeom` geometry searches (`crownDrop`, eyewear `depth`, neckwear `halfWidthAt` scans, `propSpot` key) and re-measure the 100-avatar bench.
- [ ] **Step 0:** Freeze released output (spec §9), including an explicit wardrobe corpus (every headwear/eyewear/neckwear/decor item and every prop × 3 shapes × peek/full) and one registered plugin hat: add `src/golden-v2.test.ts` with fnv1a sums of `toSvg` over a corpus (40 names × 5 themes × peek/full × 4 activities × dress on/off) and an inline snapshot of every `FACES` anchor table entry; replace the `homepage`/`repository` placeholders with the real URLs.
- [ ] **Step 1:** Run `npm pack --dry-run` in each package and assert the file lists (Review Focus 5); fix `files` fields until they match.
- [ ] **Step 2:** Run the full gate: `bun run lint && bun run check-types && bun run test && bun run build`. Expected: exit 0.
- [ ] **Step 3:** Confirm with the owner that the npm org `awflow` exists (`npm org ls awflow`) and that they approve publishing; then publish in dependency order: `@awflow/avatar`, `-export`, `-svelte`, `-react`, `-vue`, `-solid`, `-element` with `bun publish` (npm does not rewrite `workspace:`), after asserting each packed manifest (`bun pm pack` + inspect) contains no `workspace:` specifier and no private source condition (`awflow-src`), has `sideEffects`, and (React) a `'use client'` banner.
- [ ] **Step 4:** Tag `v1.0.0`, commit `release: 1.0.0`; deploy the site with `bunx wrangler deploy` once the owner has set the domain.
- [ ] **Step 5:** Unblock Plan 5 Task 7.
