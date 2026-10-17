# @awflow/avatar — design

Date: 2026-10-17 · Status: approved direction (owner reviewed the hi-fi mocks) · Mocks: https://claude.ai/artifact/Y9vvfUotQiHioeJXkZro3T

## 1. Intent

AWFlow draws its agents with a small home-grown character engine (`agentic-flow/src/lib/assistant/agents/look.ts`, `components/agents/AgentCharacter.svelte`, `builder/LookStudio.svelte`): bold shapes, colours, textures, five eye styles, six accessories and eyes that react to what the agent is doing. Separately, the owner maintains a fork of **Peek** (`/Users/dannickstark/Documents/GitHub/peek`, Doan Labs, MIT), a much better engineered avatar library: a name hashes deterministically into a face, faces are versioned so stored faces never change, 11 expressions are channel tables eased by a spring rig, and `toSvg()` renders pure SVG with no dependencies.

We build **one public npm library, `@awflow/avatar`, by adopting Peek's architecture and source as the core and extending it** with AWFlow's look and agent semantics plus new features. AWFlow becomes its first consumer and replaces its in-app engine with it.

Why: one engine instead of two, a richer and more alive character for AWFlow agents (proof of "it is working for you"), and a standalone open-source product that markets AWFlow.

## 2. Goals

- Keep Peek's rules intact: deterministic identity (same name → same SVG on server and client), per-axis hashing, append-only lists, versioned styles, per-axis overrides, pure SVG, zero runtime deps in the core.
- Merge both visual vocabularies and add new ones (shapes, parts, motifs, wardrobe, props, FX) — all drawn on shared anchors so any part fits any body.
- Add a second state layer for agents (**activity**) next to Peek's **expression**, plus one-shot **reactions**, accessory physics, group gaze and lip-sync.
- Ship **themes** (Soft = Peek, Bold = AWFlow, Mono, Neon, Clay) as a rendering choice that never changes identity.
- Ship adapters for **Svelte, React, Vue, Solid, a Web Component, and vanilla JS**, all on one core.
- Be extensible: custom themes, custom parts/accessories/props/FX (plugin API), export tools + CLI, and an AI "describe a look" schema.
- Migrate AWFlow with no visible regression for existing agents.

## 3. Non-goals

- No AI model, network call or storage inside the package (the "describe a look" feature is a schema + prompt helper only).
- No raster/3D rendering in the core (raster export lives in a separate optional package).
- Not a general illustration/avatar-maker with free drawing; everything is parametric.
- The "Proposed next" backlog on the Accessories board (cat ears, pixel style, Lottie, etc.) is **out of scope for the first release (1.0)**; it is the post-release roadmap.

## 4. Anti-goals (failure even if it "works")

- A stored face changes after an upgrade without a version bump.
- Different frameworks render different bytes for the same input.
- The core grows a runtime dependency or touches the DOM.
- Avatars jank a page: per-avatar animation loops, React/Svelte state updated every frame, animating while off-screen, or ignoring `prefers-reduced-motion`.
- AWFlow agents look worse or unrecognisable after migration (Aria must stay instantly recognisable).
- Doan Labs is not credited (MIT notice and attribution must be kept).

## 5. Constraints

- Source base: Peek at `/Users/dannickstark/Documents/GitHub/peek` (`packages/peek` = core with `draw.ts`, `identity.ts`, `tables.ts`, `animate.ts`, `svg.ts`, `adapter.ts`, `peek.tsx`; `packages/peek-svelte`; `docs/variants.md` is the identity model). Read `peek/AGENTS.md` rules — they carry over.
- License MIT. Keep Doan Labs' copyright line alongside AWFlow's in LICENSE; credit "Built on Peek by Doan Labs" in README and docs footer. Never use the Doan Labs name/mark as branding.
- Tooling follows Peek: bun workspaces + Turborepo, Biome, TypeScript, `bun test` for the core, vitest for framework adapters.
- AWFlow app is Svelte 5 (`agentic-flow`), web tests use vitest; the app runs as a browser extension (MV3) — the adapter must work without `eval`/inline-script tricks.
- npm scope `@awflow` does not exist yet (checked 2026-10-17): the owner must create the npm org `awflow` before first publish.
- **The code lives in `awflow-agant-avatar/`** (owner decision): a fresh git repo there (currently empty, not yet initialised), with Peek's code copied in — not a rename of the Peek fork, not a folder inside `agentic-flow`. Record the source Peek commit (`0f5c4ff`) in the import commit message and keep the MIT notice. The GitHub remote is chosen at first publish.
- **The AWFlow migration (section 8) is part of this project, as its last phase** (owner decision): the work is done when AWFlow runs on the package.

## 6. Decisions (made with the owner)

| Topic | Decision |
| --- | --- |
| Audience | Public library + AWFlow; agent features are part of the public API |
| Name | `@awflow/avatar` (core) + `@awflow/avatar-svelte`, `-react`, `-vue`, `-solid`, `-element`; vanilla `mount()` lives in the core; `@awflow/avatar-export` for raster/CLI |
| Architecture | Adopt Peek's implementation as the core and extend it (not a rewrite) |
| Look | Themes: Soft (Peek) and Bold (AWFlow) + Mono, Neon, Clay; themes registrable |
| Shapes | Union + new: Peek 4 (diamond, semicircle, circle, triangle) + AWFlow 6 (cube, drop, gem, cloud, ghost, peak) + new 5 (blob, capsule, bean, arch, flower). AWFlow "pebble" = circle |
| State | Two layers: `expression` (Peek's 11) + `activity` (10), plus `react()` one-shots |
| Wardrobe | All families: headwear, eyewear, neckwear, face, held prop; plus an FX layer |
| Motion | Activity loops, accessory physics, reactions, group gaze, lip-sync |
| Identity | Hash + overrides (Peek). Role-based presets are an optional helper, not the default |
| Migration | Map existing AWFlow saved looks into the new model (`fromLegacy`) |
| Extensibility | Custom themes, plugin parts, export/CLI, AI describe-a-look schema |

## 7. The model

Peek's two layers, extended (see `peek/docs/variants.md`):

```
style            peek (versions 1, 2, …)           picked by caller, default latest
├─ identity      hashed from the name, any axis overridable
│  ├─ shape      15 bodies, each with anchors
│  ├─ color      a palette slot (resolved per theme)
│  ├─ anatomy    eyes · brows · mouth · cheeks · trait · motif + persona
│  └─ wardrobe   headwear · eyewear · neckwear · face   (hashed only when dress=true)
├─ theme         rendering only: palette, frame, ink, line, light  (never hashed)
└─ state         caller / rig driven, never hashed
   ├─ expression 11 (Peek)
   ├─ activity   10 (new)
   ├─ reaction   one-shot gestures (new)
   ├─ gaze       [x,y] | 'pointer' | another avatar
   ├─ prop       held item (state-like: may follow the activity)
   └─ ring       presence / progress
```

### 7.1 Identity and versions

- Hash exactly as Peek: `seed(axis) = fnv1a(\`${style}@${version}:${axis}:${tidy(name)}\`)`, one seed per axis, persona from mulberry32 in a fixed draw order.
- **`peek@1` stays byte-identical to `@doan-labs/peek` 1.x** (same lists, same version pins, same SVG output). Peek's existing test suite is ported and must keep passing against `version: 1`.
- **`peek@2`** grows the lists (append-only) and becomes latest. Pick ranges for v2: shape 15, eyes 6, brows 4 (not `none`), mouth 5 (not `none`), cheeks 3, trait 5, motif 7 (not `rays`, reserved for Aria). Wardrobe picks `none` unless `dress: true`; with `dress`, each slot has fixed odds (headwear 45%, eyewear 25%, neckwear 20%, face 20%) — a separate seed per slot.
- Lists (v2, in order; new entries appended after Peek's):
  - shape: `diamond, semicircle, circle, triangle, cube, drop, gem, cloud, ghost, peak, blob, capsule, bean, arch, flower`
  - eyes: `oval, bead, ring, pill, dot, spark`
  - brows: `arch, bar, wedge, dash, none`
  - mouth: `poly, round, line, box, cat, none`
  - cheeks: `oval, dots, lines, none`
  - trait: `square, fin, ring, dot, peak, none`
  - motif: `plain, dots, stripes, waves, grid, speckle, glow, rays`
  - headwear: `none, bow, cap, sprout, beanie, headphones, antenna, crown, wizard, party, halo, beret, chef`
  - eyewear: `none, glasses, sunglasses, monocle, visor, patch, cateye`
  - neckwear: `none, tie, bowtie, scarf, necklace, badge`
  - face: `none, freckles, mustache, bandaid, sticker`
  - prop: `none, magnifier, pencil, coffee, bulb, book, wrench`
- Peek's axis key `face` (body silhouette) is exposed as **`shape`** in the public API; `face` becomes the face-decoration slot. Keep an internal alias so `peek@1` code paths are unchanged; accept `face: 'circle'`-style calls under `style: 'peek@1'` only.
- `color` resolves to a **palette slot**: `seed % palette.length` of the active theme; an explicit `color` may be a slot index or a hex (deep partner derived by darkening ~25%).
- Motif is hashed only when the theme enables motifs (Bold, Mono, Neon); Soft and Clay render `plain` unless overridden.

### 7.2 Shapes and anchors

Every shape carries Peek's `FaceGeom` anchors (eye centres, eye radii, pupil radius, brow line, cheek points, mouth point, crown outline polygon + radius, bottom/sink) **plus** three new ones: head width at the crown (hat scale), side width at the eye line (headphones/temples), and the neck line (neckwear). New shapes are drawn in Peek's 340-unit space. Starting anchor values for the 11 non-Peek shapes exist in the mock prototype (100-unit space; multiply by 3.4) — they are a starting point, to be tuned visually, then frozen at release (any later change bumps the version).

### 7.3 Themes

`Theme = { name, frame, colors: {body, deep}[], ink(c), sclera(c), pupil(c), motifs: boolean, motifInk(c), motifOp, shading: 'flat'|'bold'|'clay', outline?: {color(c), width, glow} }`.

Built-in values (from the mocks): **Soft** = Peek's 7 inks, ink frame `#1A1918`, ink features; **Bold** = AWFlow's 12 colours (`LOOK_COLORS`), bone frame, white 30% motifs, bottom shade; **Mono** = paper body, 2.2 ink outline, tinted cheeks; **Neon** = dark bodies with a glowing outline in the deep colour, dark frame; **Clay** = 8 mid-saturation colours with highlight + shadow + contact shadow. `defineTheme()` registers more. Peek's `frame` option (`ink|bone|paper|none`) and `riso` keep working; the theme supplies the default frame colour.

### 7.4 Expression (unchanged) and activity (new)

Expressions: Peek's 11 channel tables and `CHOREO` staggering, untouched.

Activities, each = partial channel targets + an additive loop + an FX overlay + whether it locks gaze:

| activity | channels / loop | FX | AWFlow signal (today's `chatMood`) |
| --- | --- | --- | --- |
| idle | breathing, blinks, saccades | — | no turn running |
| listening | attentive, head tilt, gaze to source | sound rings | mic open / user typing |
| thinking | gaze up, drifting; one brow up | thought bubbles | running, no tool step yet |
| working | eyes scan, typing bob; antenna blinks | spinner | toolSteps > 0 |
| speaking | mouth flaps (or driven by lip-sync) | voice waves | reply streaming |
| waiting | looks at viewer, bounce | orange "?" badge | waitingForYou |
| done | happy eyes, periodic hop | sparkles | justDone (short flash) |
| error | worried brows, shiver bursts | sweat drop | trouble |
| sleeping | eyes closed, slow breath, sink | zzz | model offline / not ready |
| offline | half-closed, dimmed | — | provider unreachable |

Blending rule: when both are set, the **activity owns eyes, gaze, body and FX; the expression keeps brows tilt/arch, lid tilt and blush** (averaged), and the mouth unless the activity sets one. Loops are additive *after* the springs so they stay crisp. Static renders (`toSvg`) use a fixed representative phase so FX are visible.

### 7.5 Reactions

`react(name)` on the live handle (and a `reaction`+`reactKey` prop pattern for declarative frameworks): `nod, shake, wink, hop, spin, shiver, gasp, love (hearts FX), giggle, celebrate (confetti FX)`. Each is a duration + a function p∈[0,1] → additive channel deltas (+ optional FX). Reactions layer over any state and never change it.

### 7.6 Rig additions

On top of Peek's springs/blinks/saccades/breathing (`animate.ts`, one shared rAF loop, direct DOM attribute writes — keep this design):
- **Accessory physics**: one damped spring per wearable that declares `physics` (antenna, sprout, party pompom, wizard tip, beanie pompom, bow, scarf tail), excited by body acceleration; per-item stiffness, damping, max swing.
- **Group gaze**: `gaze` may reference another avatar handle/element; `<AvatarGroup speaker=…>` sets members' gaze toward the speaker.
- **Lip-sync**: `speaking` mouth driven by an optional source — an audio level (0..1 from a WebAudio analyser the caller provides) or a token cadence (`face.pulse()` per streamed chunk). Without a source, the built-in flap loop runs.
- **Ring**: `{ color, progress?, pulse? }` drawn on the frame.
- **Level of detail** (from AWFlow): < 24 px body + eyes only; < 44 px no brows/cheeks/trait/props/FX (except the waiting badge); otherwise full.
- Pause off-screen (IntersectionObserver) and honour `prefers-reduced-motion` (Peek's rule: reduced motion cuts durations, never the pose).

### 7.7 Wardrobe, props, FX

Drawn on anchors, inside the body transform (except props and FX, which live in frame space). Behaviour per the Accessories board: glasses/sunglasses/monocle/visor/cat-eye keep gaze and blink (visor shows glowing pupils), hats scale with head width and sit on the crown (bow sits opposite the trait as in Peek), neckwear hangs from the neck line and is clipped by the floor, props float bottom-right and may react to the activity (bulb lights while thinking, coffee steams). Visual reference: the mock boards; Peek's six existing accessories keep their exact drawings.

### 7.8 Plugin API

`defineAccessory({ slot, name, physics?, draw })`, `defineProp(…)`, `defineFx(…)`, `defineShape({ name, geom })`, `defineTheme(…)`, registered with `registerPlugins([...])`. `draw` receives `{ anchors, color, theme ink, channels, wob, t }` and returns drawing-tree nodes (Peek's `Node`). Plugin items never enter hashed lists (they are override-only), so they cannot move existing faces.

### 7.9 Packages and public API

```
packages/
  avatar/            @awflow/avatar         toSvg, draw, identify, settle, mount, themes, plugins, LISTS, VERSIONS
                     @awflow/avatar/ai      lookSchema (JSON Schema of all axes), lookPrompt()
                     @awflow/avatar/compat  fromLegacy(awflowAvatar), lookForRole(text)
  avatar-svelte/     <Avatar>, <AvatarGroup>        (Svelte 5)
  avatar-react/      <Avatar>, <AvatarGroup>        (React ≥ 18; Peek used 19 — widen if cheap)
  avatar-vue/        <Avatar>, <AvatarGroup>        (Vue 3)
  avatar-solid/      <Avatar>, <AvatarGroup>
  avatar-element/    <awf-avatar> custom element (attributes = props, methods react()/set())
  avatar-export/     toPng / toGif(APNG) / toSprite / Lottie(optional) + CLI `npx @awflow/avatar`
apps/
  web/               docs + playground site (content per the Docs and Playground boards)
```

Common props (all adapters): `name` (required), `size`, `theme`, `style`/`version`, `framing: 'peek'|'full'`, `frame`, `square`/circle, `expression`, `activity`, `gaze`, `animate`, `fx`, `ring`, `dress`, any identity axis override, wardrobe slots, `prop`, `title` (a11y; Peek semantics). Live handle: `set(partial)`, `react(name)`, `pulse()`, `destroy()`. `mount(el, opts)` is the vanilla entry and what the Web Component and non-React adapters build on (Peek's `adapter.ts` / `Live` is the seed of this).

Framing: `peek` = Peek's cropped portrait rising from the floor; `full` = whole body centred with head-room for hats (for chat bubbles, stickers, frame `none`).

## 8. AWFlow migration

- Add `@awflow/avatar-svelte` to `agentic-flow`; replace `AgentCharacter.svelte` internals with `<Avatar>`, keeping its props (`look`, `mood`, `size`, `follow`, `seed`) as a thin wrapper so call sites don't change in the first step.
- `chatMood()` output maps 1:1 to activities (`idle, thinking, working, waiting, done, cant→error, sleeping`); `follow` → `gaze="pointer"`.
- Saved looks: `fromLegacy(agent.avatar)` → Bold theme overrides with brows/mouth/cheeks/trait `none` and the stored shape/colour/motif/eyes/acc mapped (`pebble→circle`, `pills→pill`, `dots→dot`, `round→oval`, `sleepy→bead`, `glasses→eyewear`, others → headwear). Existing agents look as they do today until the user picks "Upgrade face" in the studio (sets new fields; schema additions are optional fields on `agent.avatar`).
- Aria: locked signature (circle, `#f08a24`, rays, pill eyes) now with a `line` mouth and oval cheeks; `rays` stays reserved.
- LookStudio redesign per the "AWFlow in context" board: state preview + reaction buttons, describe-a-look (calls the app's own assistant with `lookSchema`), role suggestions (`lookForRole`), theme, shape/hat pickers as mini avatars, colour swatches, eyes/mouth/eyewear/prop chips. Presence rings in agent lists; team stacks use `<AvatarGroup>`.
- Per the owner's standing rules: evaluate docs impact in `Agentic-Flow-Doc`, run `bun run translate:extract` after adding UI strings, merge locally to Dev, verify with `bun run build`.

## 9. Testing and quality bars

- Port Peek's tests; `peek@1` snapshot equality against `@doan-labs/peek` output for a fixed name corpus (byte-identical SVG).
- `peek@2` golden snapshots for a fixed corpus × themes; any diff fails CI unless the version is bumped.
- Cross-adapter test: every adapter's server/static render equals `toSvg` for the same props.
- Rig tests with a fake clock: springs converge, reactions end, reduced motion snaps, off-screen pauses.
- Perf budget: 100 animated 48 px avatars on one page stay smooth (one shared loop, attribute writes only).
- Bundle size is measured and published; the docs placeholder `[bundle size]` is filled from CI.

## 10. Build order (suggested)

1. Repo scaffold (bun + turbo + biome, mirroring Peek), copy Peek core + svelte + react with history note and LICENSE; tests green; rename to `@awflow/avatar*`.
2. Identity v2: shapes + anchors, parts, motifs, themes, `shape`/`face` key split, versions, compat helpers.
3. Activity layer, reactions, rig additions (physics, ring, LOD, group gaze, lip-sync hooks), FX layer.
4. Wardrobe + props drawings, plugin API.
5. Adapters: Svelte (first, for AWFlow), React, Vue, Solid, element, vanilla `mount`.
6. AWFlow migration (section 8).
7. Export package + CLI, AI schema, docs/playground site, first publish.

## 11. Left to the builder

- Exact drawings of new shapes/parts/items within the established style (mocks are the visual reference, Peek's drawings are the quality bar) and final anchor numbers.
- Internal module layout, how themes thread through `draw()`, how physics state lives in `Live`.
- Raster export implementation (resvg-wasm, canvas, etc.) and whether Lottie ships in 1.0 or later.
- Docs site framework (Peek uses TanStack Start on Cloudflare; reusing it is fine).
- Exact spring constants and loop timings (the mock prototype's values are a starting point).

## 12. Calls I made (owner to check)

- `peek@1` kept byte-identical and selectable; `peek@2` is the default latest.
- Public axis renamed `face` → `shape`; `face` reused for face decorations.
- Wardrobe auto-pick is opt-in (`dress`) so plain faces stay plain.
- `rays` motif reserved for Aria; not hashed.
- Plugin items are override-only (never hashed).
- The vanilla `mount()` lives in the core package rather than a separate package.
- The "Proposed next" list is the post-1.0 roadmap, not 1.0 scope.
