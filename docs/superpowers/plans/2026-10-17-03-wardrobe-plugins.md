# Plan 3 — Wardrobe, props & plugin API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw the new wardrobe items (9 headwear, 4 eyewear, 4 neckwear, 4 face decorations, 6 held props) on shape anchors with physics where declared, expose a plugin API so third parties add accessories, props, FX, shapes and themes, and ship the `@awflow/avatar/ai` look schema.

**Architecture:** New items live in focused modules under `packages/avatar/src/wardrobe/`, each exporting a draw function over a shared `WearCtx`; `draw.ts` dispatches to them by slot. Peek's six original accessories stay exactly where they are (byte identity). Plugins register into the same dispatch tables and are override-only (never hashed).

**Tech Stack:** as Plan 1.

**Spec:** `docs/superpowers/specs/2026-10-17-awflow-avatar-design.md` (§7.7, §7.8, §7.9 `@awflow/avatar/ai`)

## Global Constraints

- Roadmap shared constraints apply.
- Peek's `bow, cap, sprout, glasses, sunglasses, tie` drawings are unchanged; any test with only those items keeps its previous output.
- Every item: keyed nodes under `wear.<slot>.<name>.*` (plugins: `plugin.<name>.*`); finite on all 15 shapes × 11 expressions × 10 activities; live tree stable across poses.
- Hats scale with `clamp(sh.hw / 88, 0.55, 1.2)` and sit on the crown top; eyewear keeps gaze and blink visible (except `patch`, `sunglasses`); neckwear hangs from `sh.neck` and is clipped by the floor like Peek's tie; props float in frame space at the bottom-right.
- Visual reference: mock board "04 · Wardrobe" (prototype drawings in `Avatar.dc.html` of the canvas, 100-unit space ×3.4).

## Review Focus

1. **Every item on the narrowest shapes** (triangle, peak, drop: hw ≤ 30) — hats must not float off or swallow the head; expected: scaled down and seated on the tip. Test in Task 1 (crown contact: the hat's lowest point is within 8 frame units of the crown top on every shape).
2. **Stacking slots** — headphones + glasses + scarf + prop together; expected: no z-order surprises (eyewear over eyes, headphones over eyewear temples, prop over neckwear). Test in Task 2 (node order assertion).
3. **Plugin naming collisions** — registering `headwear: 'cap'` (a built-in) or the same plugin twice; expected: built-ins cannot be replaced (throws a clear error), re-registering the same plugin object is a no-op. Test in Task 5.
4. **A plugin draw that throws or returns NaN** — expected: the avatar still renders without that item (caught, logged once), never a broken SVG. Test in Task 5.
5. **Props at small sizes** — expected: hidden under 44 px (LOD). Test in Task 4.

---

### Task 1: Shared wearable context and the new headwear

**Files:**
- Create: `packages/avatar/src/node.ts` (move Peek's private `n()`/`prune()` here unchanged, export `el = n`), `src/wardrobe/context.ts`, `src/wardrobe/headwear.ts`
- Modify: `src/draw.ts` (import `n`/`prune` from `node.ts`; dispatch non-Peek headwear)
- Test: `packages/avatar/src/wardrobe/headwear.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function el(tag: string, key: string, attrs: Record<string, string | number | false | undefined>, children?: Node[]): Node
  export type WearCtx = {
    sh: FaceGeom; who: Drawable; pose: Pose; theme: Theme; ink: Ink
    g: (c: Channel) => number          // persona-adjusted channel (Peek's g())
    bodyTransform: string              // the transform Peek applies to the body group
    stroke: number                     // Peek's strokeFor(size)
    id: string; size: number
  }
  export type WearDraw = (ctx: WearCtx) => Node[]
  export const HEADWEAR: Record<'beanie'|'headphones'|'antenna'|'crown'|'wizard'|'party'|'halo'|'beret'|'chef', { draw: WearDraw; physics?: SwingSpec }>
  ```
- Physics: `antenna {stiffness 9, damping 0.15, maxSwing 26}`, `party {10, 0.2, 18}` (pompom), `wizard {8, 0.2, 14}` (tip), `beanie {10, 0.22, 16}` (pompom); others none. Physics items rotate their swinging part by `pose.wob` (Plan 2) about its attachment point.
- Behaviour: `headphones` band spans `±(sh.side + 3)` at the eye line, cups glow cyan `#5CF2E8` while `activity === 'listening'` (opacity `0.6 + 0.4·sin(6t)`), orange `#F08A24` otherwise; `antenna` ball blinks cyan at `sin(10t) > 0` while `working`; `halo` bobs `1.2·sin(2t)` above the crown; colours per the mock (beanie `#E5677A`, crown `#F2C14E`/`#B8860B`, wizard `#5B4BB7`, party `#F28C6B` + `#F5C451` stripes, beret `#C9573A`, chef paper + ink).

- [ ] **Step 1: Write the failing tests:** each new headwear × 15 shapes × 3 expressions (normal, happy, sleepy) is clean; crown contact (Review Focus 1); live tree stable across 20 random poses incl. `wob ∈ [−28, 28]`; Peek items unchanged (snapshot of `toSvg('Doan Labs', {headwear: 'sprout', version: 1})` equals the pre-change value recorded in Step 1).
- [ ] **Step 2:** Run `bun test src/wardrobe/headwear.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `node.ts` move (pure refactor, golden v1 must stay green), `context.ts` (build `WearCtx` inside `draw()`), `headwear.ts`.
- [ ] **Step 4:** Run `bun test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(core): new headwear with physics`.

### Task 2: Eyewear additions

**Files:**
- Create: `packages/avatar/src/wardrobe/eyewear.ts`
- Modify: `src/draw.ts`
- Test: `packages/avatar/src/wardrobe/eyewear.test.ts`

**Interfaces:**
- Produces `EYEWEAR: Record<'monocle'|'visor'|'patch'|'cateye', { draw: WearDraw }>`.
- `monocle`: gold ring `#C9952A` on the right eye + chain; `visor`: dark band `#23252F` across both eyes with glowing cyan `#5CF2E8` pupils that follow `gx` (×3 frame units) and squash with lid/blink, real eyes not drawn; `patch`: ink ellipse over the left eye + strap; `cateye`: upswept lenses, rose tint `#E5677A` op 0.22, ink frame.
- Node order in the body group: eyes → brows → eyewear → headwear → neckwear; props/FX after the body group.

- [ ] **Step 1: Write the failing tests:** each item × 15 shapes × 11 expressions clean; `visor` output has no `eyes.L.sclera` node and its glow x-position moves with `gx`; z-order assertion for headphones + glasses + scarf + prop (Review Focus 2).
- [ ] **Step 2:** Run `bun test src/wardrobe/eyewear.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `bun test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(core): monocle, visor, patch, cat-eye`.

### Task 3: Neckwear and face decorations

**Files:**
- Create: `packages/avatar/src/wardrobe/neckwear.ts`, `src/wardrobe/decor.ts`
- Modify: `src/draw.ts`
- Test: `packages/avatar/src/wardrobe/neck-decor.test.ts`

**Interfaces:**
- Produces `NECKWEAR: Record<'bowtie'|'scarf'|'necklace'|'badge', { draw: WearDraw; physics?: SwingSpec }>` (scarf tail physics `{9, 0.2, 20}`) and `DECOR: Record<'freckles'|'mustache'|'bandaid'|'sticker', { draw: WearDraw }>`.
- `bowtie` red `#E5412D`; `scarf` `#F0A54A` band width `min(sh.side, 115)` with white stripes and a swinging tail; `necklace` 9 pearls on an arc; `badge` blue lanyard + white card with orange lines; `freckles` 3 dots per cheek `#8A5A3B` op 0.7; `mustache` ink curl above the mouth; `bandaid` on the right cheek `#E9C29B`; `sticker` gold star on the left cheek.

- [ ] **Step 1: Write the failing tests:** each item × 15 shapes × 11 expressions clean; neckwear nodes carry the floor clip like Peek's tie; `settle('Linh', {face: 'freckles'})` renders `wear.decor.freckles.*` nodes.
- [ ] **Step 2:** Run `bun test src/wardrobe/neck-decor.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `bun test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(core): neckwear and face decorations`.

### Task 4: Held props

**Files:**
- Create: `packages/avatar/src/wardrobe/props.ts`
- Modify: `src/draw.ts`
- Test: `packages/avatar/src/wardrobe/props.test.ts`

**Interfaces:**
- Produces `PROPS: Record<'magnifier'|'pencil'|'coffee'|'bulb'|'book'|'wrench', { draw: WearDraw }>`.
- Placement: frame space, centre `(279, 265)` (= prototype (82, 78) ×3.4) bobbing `4·sin(2.2t+1)`, rotation `−10 + 4·sin(1.4t)`°. `bulb` lights (`#F9D976` + halo) when `activity ∈ {thinking, done}`; `coffee` steams (phase `(0.8t)%1`). Hidden under 44 px.

- [ ] **Step 1: Write the failing tests:** each prop × 10 activities clean; `size: 40` has no `wear.prop.*` nodes; `bulb` has a halo node only for thinking/done.
- [ ] **Step 2:** Run `bun test src/wardrobe/props.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `bun test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(core): held props`.

### Task 5: Plugin API

**Files:**
- Create: `packages/avatar/src/plugins.ts`
- Modify: `src/draw.ts` (dispatch falls back to the registry), `src/svg.ts` (overrides accept registered names), `src/index.ts`
- Test: `packages/avatar/src/plugins.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AccessoryPlugin = { kind: 'accessory'; slot: 'headwear'|'eyewear'|'neckwear'|'decor'; name: string; physics?: SwingSpec; draw: WearDraw }
  export type PropPlugin = { kind: 'prop'; name: string; draw: WearDraw }
  export type FxPlugin = { kind: 'fx'; name: string; shapes: (t: number, p: number, anchor: Parameters<typeof fxShapes>[3]) => FxShape[] }
  export type ShapePlugin = { kind: 'shape'; name: string; geom: FaceGeom }
  export type ThemePlugin = { kind: 'theme'; theme: Theme }
  export type Plugin = AccessoryPlugin | PropPlugin | FxPlugin | ShapePlugin | ThemePlugin
  export const defineAccessory: (p: Omit<AccessoryPlugin, 'kind'>) => AccessoryPlugin
  export const defineProp: (p: Omit<PropPlugin, 'kind'>) => PropPlugin
  export const defineFx: (p: Omit<FxPlugin, 'kind'>) => FxPlugin
  export const defineShape: (p: Omit<ShapePlugin, 'kind'>) => ShapePlugin
  export function registerPlugins(list: Plugin[]): void
  export function plugins(): ReadonlyArray<Plugin>
  ```
- Rules: names matching a built-in throw `Error('"cap" is a built-in headwear and cannot be replaced')`; registering the identical object twice is a no-op, a different object with a taken name throws; plugin items are never hashed (only reachable via explicit overrides, incl. `shape` for shape plugins); a plugin `draw` that throws or yields non-finite numbers is skipped for that render and reported once via `console.warn`. Registered FX may be used by `react()`/activities only via plugin-defined activity hooks — out of scope; FX plugins are drawable via the string form of the `fx` option from Plan 2 (`fx: 'my-fx'`) in this task.
- `defineTheme` from Plan 1 is re-exported here as a `ThemePlugin` factory too (`defineTheme(t)` keeps working standalone).

- [ ] **Step 1: Write the failing tests:** register a `cat-ears` headwear and render `toSvg('Linh', {headwear: 'cat-ears'})` → contains `plugin.cat-ears.*`; built-in collision throws the exact message; double registration no-op; throwing plugin → valid SVG without its nodes + one warning; hashing unaffected (`identify` for 500 names identical before/after registering); a shape plugin renders with all parts clean.
- [ ] **Step 2:** Run `bun test src/plugins.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `bun test && bun run build && bun run check-types`. Expected: PASS / exit 0.
- [ ] **Step 5:** Commit `feat(core): plugin API`.

### Task 6: `@awflow/avatar/ai` — look schema and prompt helper

**Files:**
- Create: `packages/avatar/src/ai.ts`; add `./ai` to `package.json#exports` and `scripts/build.ts`
- Test: `packages/avatar/src/ai.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function lookSchema(): object                 // JSON Schema (draft 2020-12) of the overridable look: theme, shape, color (slot or hex pattern), eyes, brows, mouth, cheeks, trait, motif, headwear, eyewear, neckwear, face, prop — enums built from LISTS + THEMES + registered plugins at call time; additionalProperties false; all optional
  export function lookPrompt(opts?: { locale?: string }): string   // system prompt: describes each axis in one line with its allowed values, asks for JSON only, never invent values
  export function parseLook(input: unknown): AvatarOptions          // validates against the schema rules; drops unknown keys and invalid values, never throws
  ```
- No network, no model, no dependency (hand-written validation, no ajv).

- [ ] **Step 1: Write the failing tests:** `lookSchema().properties.headwear.enum` equals `LISTS.headwear`; after registering a plugin hat it includes the plugin name; `parseLook({headwear: 'wizard', prop: 'coffee', eyes: 'bead', foo: 1, shape: 'star'})` → `{headwear: 'wizard', prop: 'coffee', eyes: 'bead'}`; `parseLook('nope')` → `{}`; `parseLook({color: '#AbC'})` → `{color: '#aabbcc'}`; `lookPrompt()` mentions every axis name.
- [ ] **Step 2:** Run `bun test src/ai.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `bun test && bun run build`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(core): ai look schema and prompt helper`.
