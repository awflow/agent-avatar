# Plan 5 — AWFlow migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AWFlow (`agentic-flow`) draws every agent with `@awflow/avatar-svelte`: existing agents look as before, chat states map to activities, the Look studio is redesigned per the mock, team stacks share gaze, and the old engine is removed.

**Architecture:** Step 1 keeps every call site unchanged: `AgentCharacter.svelte` and `AgentAvatar.svelte` keep their props and become thin wrappers over `<Avatar>`, with `look.ts` translating AWFlow looks/moods into package options. Then the schema gains an optional v2 `look` object, the studio writes it, and the CSS-driven motion code is deleted.

**Tech Stack:** SvelteKit/Svelte 5 browser extension (`agentic-flow`), vitest, zod v4, wuchale i18n, `@awflow/avatar-svelte` + `@awflow/avatar/compat` + `@awflow/avatar/ai` (Plans 1–4).

**Spec:** `docs/superpowers/specs/2026-10-17-awflow-avatar-design.md` (§8)

## Global Constraints

- Work in `agentic-flow` on a branch from `Dev` (e.g. `feat/awflow-avatar`); merge locally into `Dev` when the plan is done and gates pass; one final PR per repo, no per-task PRs.
- Until Plan 6 publishes, depend on the package with `"@awflow/avatar-svelte": "file:../awflow-agant-avatar/packages/avatar-svelte"` (and the core the same way); Task 7 swaps to the published version.
- Gates before merge: `bun run test:unit -- --run` (web tests import from `vitest`), `bun run build`, and the extension builds; `bun run check` has ~655 pre-existing errors — compare counts, add none.
- After adding UI strings run `bun run translate:extract` (never rely on the dev server to update catalogs; restore `.po` files from `Dev` if the dev server wiped them).
- Never edit `src/lib/components/ui/**` (shadcn generated).
- Aria stays instantly recognisable: `ARIA` preset from `@awflow/avatar/compat`.
- Existing agents render the legacy-equivalent look (`fromLegacy`) until the user upgrades in the studio.

## Review Focus

1. **Agents saved with partial/old avatar data** — `{color}` only, unknown `shape`, `icon: 'sunburst'`; expected: still renders (hash fills gaps; sunburst = Aria). Test in Task 2.
2. **Motion preference "off"/"calm" and reduced motion** — expected: off = static, calm = animated without reactions/FX, lively = full; reduced motion always static. Test in Task 1.
3. **Dense lists** (agents page, chat list, team clusters at 16–28 px) — expected: LOD keeps them legible and cheap (no FX, single shared loop). Test in Task 1 (size 16 renders no `fx.*`).
4. **Shared/marketplace agents from older app versions** carrying the v2 `look` field with values this build does not know — expected: unknown values dropped by `parseLook`, never a crash. Test in Task 2.
5. **Streaming flicker** — mood changing idle↔speaking every chunk; expected: smooth (springs) and no re-render of the `<svg>` (state change only). Test in Task 3.

---

### Task 1: Wrap the package behind the existing components

**Files:**
- Modify: `agentic-flow/package.json`, `src/lib/components/agents/AgentCharacter.svelte`, `src/lib/components/agents/AgentAvatar.svelte`, `src/lib/assistant/agents/look.ts`
- Test: `src/lib/assistant/agents/__tests__/look.test.ts`, `src/lib/components/agents/__tests__/AgentCharacter.svelte.test.ts` (new)

**Interfaces:**
- Produces in `look.ts`:
  ```ts
  export function lookToOptions(look: AgentLook): AvatarOptions        // legacy look → fromLegacy(...) 
  export function moodToActivity(mood: AgentMood): Activity            // idle→idle, thinking→thinking, working→working, waiting→waiting, done→done, cant→error, sleeping→sleeping, speaking→speaking, still→idle
  export function motionToProps(m: AgentMotion, reduced: boolean): { animate: boolean; fx: boolean; reactions: boolean }  // lively → all true; calm → animate only; off or reduced → all false
  ```
- `AgentCharacter` keeps props `look, mood, size, follow, seed, class`; renders `<Avatar name={seedName} {...lookToOptions(look)} activity={moodToActivity(mood)} framing="full" frame="none" size gaze={follow && size >= 44 ? 'pointer' : undefined} {...motionToProps(...)}/>`. `seedName` = the agent id or name passed down from `AgentAvatar` (add an optional `name` prop; default `look.color`).
- `AgentMood` gains `'speaking'`.

- [ ] **Step 1: Write the failing tests:** each `moodToActivity` row; `motionToProps` table (lively/calm/off × reduced); `lookToOptions` for a pebble/headphones look equals `fromLegacy` output; rendering `AgentCharacter` at size 16 yields an `<svg>` with no `fx.` keyed nodes; at size 96 with `mood: 'waiting'` it contains the ask badge.
- [ ] **Step 2:** Run `bun run test:unit -- --run src/lib/assistant/agents/__tests__/look.test.ts src/lib/components/agents/__tests__/AgentCharacter.svelte.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Add the `file:` dependencies, implement the mapping functions and the wrapper.
- [ ] **Step 4:** Run the tests and `bun run build`. Expected: PASS / exit 0. Manually load the extension (or `bun run dev:web`) and check the agents page, a chat and a team thread render.
- [ ] **Step 5:** Commit `feat(agents): draw characters with @awflow/avatar`.

### Task 2: Schema v2 look and resolution

**Files:**
- Modify: `src/lib/schemas/agent.ts`, `src/lib/assistant/agents/look.ts` (`resolveLook`), `src/lib/assistant/agents/shareable.ts` (export/import keeps `look`)
- Test: `src/lib/assistant/agents/__tests__/look.test.ts`, `__tests__/shareable.test.ts`

**Interfaces:**
- `agent.avatar` gains `look: z.record(z.string(), z.unknown()).optional()` — the package options object, validated at read time with `parseLook` (not by zod enums, so newer values from other app versions don't fail parsing).
- `resolveLook(a): AvatarOptions` → `ARIA` for Aria (`id === 'aria' || icon === 'sunburst'`); else `parseLook(av.look)` when present (theme defaults to `bold`); else `fromLegacy(av)`; the name seed is the agent id (fallback name).
- `lookForRole(text)` callers (new agent drafts, `draft.ts`/`templates.ts`) switch to `@awflow/avatar/compat`'s `lookForRole` and store the result in `avatar.look`.

- [ ] **Step 1: Write the failing tests:** `{color: '#1d4ed8'}` only → valid options (hash fills the rest); unknown legacy `shape: 'star'` → shape omitted; sunburst → `ARIA`; `look: {headwear: 'jetpack', eyes: 'bead'}` → `{eyes: 'bead', theme: 'bold'}`; shareable export/import round-trips `look`.
- [ ] **Step 2:** Run the two test files. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `bun run test:unit -- --run`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(agents): optional v2 look on agents`.

### Task 3: Chat states → activities, speaking and pulses

**Files:**
- Modify: `src/lib/assistant/agents/look.ts` (`chatMood`), `src/routes/app/assistant/+page.svelte`, `src/lib/components/assistant/*` where the chat agent avatar is drawn
- Test: `src/lib/assistant/agents/__tests__/look.test.ts`

**Interfaces:**
- `chatMood` returns `'speaking'` when `running && streaming` (was `'idle'`); everything else unchanged.
- The chat page passes `bind:this` on the agent `<Avatar>` and calls `pulse()` once per streamed chunk (throttled to ≥ 60 ms) when motion is lively.

- [ ] **Step 1: Write the failing tests:** `chatMood({running: true, streaming: true, toolSteps: 0, waitingForYou: false})` → `'speaking'`; precedence unchanged for waiting > working > thinking; a mood switch idle→speaking on a mounted `AgentCharacter` keeps the same `<svg>` element.
- [ ] **Step 2:** Run the test file. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(agents): speaking state with streaming pulses`.

### Task 4: Look studio redesign

**Files:**
- Modify: `src/lib/components/agents/builder/LookStudio.svelte`, `builder/IdentityPreview.svelte`
- Create: `src/lib/components/agents/builder/look/StatePreview.svelte`, `look/AvatarPicker.svelte` (grid of mini avatars as radio buttons), `look/DescribeLook.svelte`
- Test: `src/lib/components/agents/builder/__tests__/LookStudio.svelte.test.ts`

**Interfaces:**
- Layout per mock board "06 · AWFlow in context": left preview (250 px) with state chips (Idle, Thinking, Working, Needs you, Done, Offline) and reaction buttons (wink, hop, nod, celebrate); right: Describe a look (input + "Ask Aria" + Shuffle), role suggestions (`lookForRole` variants), Theme chips, Shape picker (15 mini avatars, 40 px), Colour swatches (theme palette), Eyes / Mouth chips, Headwear picker (mini avatars, 44 px), Eyewear and Prop chips; an "Upgrade face" toggle appears for legacy looks (turns `fromLegacy` overrides into a v2 `look` with brows/mouth/cheeks/trait unset).
- `DescribeLook` sends `lookPrompt()` + the text to the user's configured assistant model through the app's existing one-shot completion helper (the one Aria's tools use for structured output), requests JSON matching `lookSchema()`, applies `parseLook(result)`; on failure shows an inline error and changes nothing.
- Every pick writes `onchange({ avatar: { ...agent.avatar, look } })`. Pickers are real radio groups (keyboard + `aria-label`).

- [ ] **Step 1: Write the failing tests:** clicking a shape tile calls `onchange` with `look.shape`; state chips change only the preview (no `onchange`); "Upgrade face" on a legacy agent writes a `look` whose shape/colour/headwear equal the legacy ones; DescribeLook with a mocked completion returning `{"headwear":"wizard","prop":"coffee","bogus":1}` writes `{headwear: 'wizard', prop: 'coffee'}`; a rejected completion leaves the look unchanged and shows the error.
- [ ] **Step 2:** Run the test file. Expected: FAIL.
- [ ] **Step 3:** Implement; run `bun run translate:extract` for the new strings.
- [ ] **Step 4:** Run tests + `bun run build`; check the studio in the browser (`bun run dev:web`, agents → an agent → Identity). Expected: PASS; matches the mock layout.
- [ ] **Step 5:** Commit `feat(agents): redesigned look studio`.

### Task 5: Team stacks, presence rings, cleanup

**Files:**
- Modify: `src/lib/components/teams/TeamAvatars.svelte`, `src/lib/components/teams/TeamThreadView.svelte`, `src/routes/app/agents/+page.svelte`, `src/lib/components/settings/AgentMotionSetting.svelte`
- Delete: CSS motion code in `src/lib/assistant/agents/motion.svelte.ts` (`liveCharacter`, pointer listener) — keep `agentMotion` preference; legacy geometry in `look.ts` (`SHAPE_GEOMETRY`, `RAYS_PATH`, `characterParts`) and their tests
- Test: `src/lib/components/teams/__tests__/TeamAvatars.svelte.test.ts` (new)

**Interfaces:**
- `TeamAvatars` gains `speaker?: string` (agent id) and wraps members in `<AvatarGroup speaker>`; `TeamThreadView` passes the agent currently streaming. Agent list rows pass `ring={{ color: '#F08A24', pulse: true }}` while an agent waits for approval and `ring={{ color: '#4f86f7', progress }}` while a routine run reports progress (omit when unknown).

- [ ] **Step 1: Write the failing tests:** `TeamAvatars` with `speaker` renders an `AvatarGroup` and members' handles receive `lookAt(speaker)` (spy); no remaining imports of the deleted symbols (`rg -n "characterParts|SHAPE_GEOMETRY|liveCharacter" src` returns nothing).
- [ ] **Step 2:** Run the test file. Expected: FAIL.
- [ ] **Step 3:** Implement and delete the old code.
- [ ] **Step 4:** Run `bun run test:unit -- --run && bun run build`; compare `bun run check` error count with `Dev` (must not grow). Expected: PASS.
- [ ] **Step 5:** Commit `feat(teams): shared gaze and presence rings; remove legacy character engine`.

### Task 6: Docs and local merge

**Files:**
- Modify/Create in `Agentic-Flow-Doc` (branch from `Dev`): `src/content/docs/app/chat-and-agents/` — the agent identity/look page (create `agent-look.mdx` if none covers it) and `src/content/docs/app/settings/general.mdx` (Agent animations wording); French mirror under `src/content/docs/fr/` if the page exists there
- Test: `bun run build` in `Agentic-Flow-Doc`

- [ ] **Step 1:** Write the page: what the avatar shows (activities table in plain words), the look studio controls, Describe a look, Upgrade face, motion preference; screenshots per the guided-screenshot rule (annotated single-screen shot for the studio).
- [ ] **Step 2:** Run `bun run build` in `Agentic-Flow-Doc`. Expected: exit 0, no broken links.
- [ ] **Step 3:** In `agentic-flow`, run all gates (Global Constraints) and merge `feat/awflow-avatar` into `Dev` locally; same for the docs branch.
- [ ] **Step 4:** Commit/merge messages: `docs(app): agent look and states`, `Merge feat/awflow-avatar into Dev`.

### Task 7: Switch to the published package (after Plan 6 publishes)

**Files:**
- Modify: `agentic-flow/package.json`, `bun.lock`

- [ ] **Step 1:** Replace the `file:` specifiers with `"@awflow/avatar": "^1.0.0"` and `"@awflow/avatar-svelte": "^1.0.0"`; `bun install`.
- [ ] **Step 2:** Run `bun run test:unit -- --run && bun run build`. Expected: PASS / exit 0.
- [ ] **Step 3:** Commit `chore(deps): use published @awflow/avatar 1.0.0` on `Dev`.
