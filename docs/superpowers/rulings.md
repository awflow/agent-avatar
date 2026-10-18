# Controller rulings, @awflow/avatar plans 1-6

Every decision taken during subagent-driven execution (2026-10-17/18), with what it costs if wrong. Collected from the per-plan SDD ledgers before they were deleted.

## 2026-10-17-01-foundation-identity

- T1 skips `git init` and the docs commit; its commit contains only the import + scaffolding: repo was initialised for the SDD workspace · cost if wrong: none.
- keep the repo's existing .gitignore lines (graft/, .ignore, .superpowers/) on top of Peek's: they are tool caches · cost if wrong: none.
- T2 tests that say `version: 2` run without `version` (explicit `color` overrides bypass hashing, so v2 is not needed); T3 adds v2 coverage: avoids T2 depending on T3 · cost if wrong: theme×colour coverage only at v1 until T3.
- T4 adds `version: 1` to Peek-era tests that pass `face` as a silhouette override: `face` changes meaning under v2 per spec §7.1 · cost if wrong: none (tests keep their expectations).
- T8 adds `lod?: boolean` to AvatarOptions/DrawOptions (default: on for v≥2, off for v1): plan text implies it · cost if wrong: one extra option.
- framework adapters (Plan 4) do not accept the `style` option (it clashes with the CSS style prop in React/Vue/Solid/Svelte); adapters pin with `version`; `style: 'peek@N'` stays for toSvg/settle/mount: spec lists style/version as alternatives · cost if wrong: adapter users write version: 1 instead of style='peek@1'.
- accept Task 4 switching Peek-era `face` tests to `shape` instead of adding `version: 1`: shape is version-independent and v1 `face` semantics have their own test · cost if wrong: thinner v1 face coverage (minor below)
- Task 1 left 8 packages/avatar-svelte/.svelte-kit files tracked (brief said exclude .svelte-kit; Peek's .gitignore lacks it): confirmed gap, fixed in Task 9's fix round (git rm --cached + .gitignore line) · cost if wrong: none
- final-review fix wave = I1, I2, I4 + minors (svelte style Omit, exports, theme default in draw(), test leak): cheap, protect determinism before Plan 2 · cost if wrong: small extra diff
- I3 (ring always emitted in live mode, ring out of id hash + adapter re-render key) is carried into Plan 2 Task 2's dispatch, not fixed now: Plan 2 owns ring pulse/live · cost if wrong: ring progress remounts until Plan 2 T2
- Plan 2 Task 1 dispatch must strip default Pose fields (activity idle, t, wob 0, fx null, fxP 0, voice -1) from the id hash; Plan 2 Task 2 must place FX inside the full-framing transform: reviewer seams · cost if wrong: v1 ids change (caught by parity test)
- shape-less legacy AWFlow agents keep today's silhouette: Plan 5 resolveLook passes AWFlow's LEGACY_SHAPES[hashOf(id)] pick as `shape` before/with fromLegacy (spec §8 "look as they do today") · cost if wrong: none, matches current app
- peek@2 golden SVG corpus + anchor-table pin added to Plan 6 Task 5 checklist: spec §9 · cost if wrong: none
- keep all plan workspaces until every plan is finished, then collect every Ruling: line into the final message before deleting: six plans run back to back on one branch · cost if wrong: none

## 2026-10-17-02-state-motion

- every Pose field / channel added in Plan 2 (activity 'idle', t, wob 0, fx null, fxP 0, voice -1, winkR 0) is stripped from the svg id hash at its default: keeps v1/v2 ids stable; Plan 1's parity test guards it · cost if wrong: ids change (caught by tests)
- Task 2 always emits the ring node in live mode (opacity 0 when no ring), removes `ring` from the id hash, and documents that adapters must keep ring out of their re-render key (Plan 4): ring is state (spec §7.4 ring under state) · cost if wrong: none
- Task 2 draws FX inside the full-framing transform (or maps anchors through it) so FX follow the body under framing 'full': cost if wrong: misplaced FX in full framing
- restPose skips activityLoop for 'idle' (static): applying idle breathing statically would change every existing pose/id; idle loop only runs live · cost if wrong: none visible
- live (animate) trees gain the 24 fx pool nodes + always-present ring node even at peek@1; static toSvg bytes stay byte-identical (parity snapshot strips those nodes from the live-tree sum): byte identity is the toSvg contract; hidden live nodes are invisible · cost if wrong: animated v1 DOM differs from @doan-labs/peek's by invisible nodes
- brief's 'paint passes t = clock' conflicts with the constraint 'static phase for toSvg and first paint: t = 0.9 s': constraint wins: live loop/fx clock starts at REST_T so hydration doesn't jump · cost if wrong: none
- restore per-avatar loop phase deterministically: phase = fnv1a(key) derived, passed to restPose (static) AND Live, so servers and clients agree and teams don't bob in sync (AWFlow offsets avatars today) · carried into Task 3's dispatch · cost if wrong: v2 static non-idle bytes shift (no released golden)
- accept hop's 4% landing taper (brief's own "≈0 at p=1" test vs 12% squash): avoids end-of-reaction pop · cost if wrong: none visible
- after a pulse with no voice source, the mouth stays closed for 1 s, then the built-in flap resumes: streaming pulses arrive more often than 1 s; a stalled stream falls back to the flap · cost if wrong: brief pauses look like flap
- reduced motion ignores voice/pulse (pose.voice −1): consistent with frozen loops · cost if wrong: no mouth motion for reduced-motion users while speaking
- Plan 2 fix wave = I1, I4 + minors (un-reduce pose pop, ring pulse peak at REST_T, dt clamp inside step, freeze ACTIVITIES/REACTIONS exports, shared __motion test helper, lockGaze test vs control, pulse hold/resume + reduced no-op tests, pulse ignored unless speaking): cheap and protects determinism before adapters · cost if wrong: small diff
- I2: follow spec §7.6 "one damped spring per wearable": Plan 3 Task 1 adds Pose.swing (per-slot angles, absent by default, stripped from id hash) and Live steps one Swing per declared spec; this REPLACES Plan 3's pre-flight "single shared swing" ruling · cost if wrong: slightly more per-frame work
- I3: amend Plan 4: whole `ring` is state (forwarded to Live.setRing, never an identity change); animated SSR emits the live tree (settle(...,true)) so attach() binds correctly; bind() verifies tag/child count; parity vs toSvg only for non-animated avatars · cost if wrong: none
- move Plan 6 Task 1 (pure Rig extraction) to the start of Plan 4 (new Task 0) so mount/adapters build on the final structure: reviewer recommendation; animate.ts at its limit · cost if wrong: Plan 6 loses nothing

## 2026-10-17-03-wardrobe-plugins

- props (T4) are drawn inside the full-framing transform like FX, so they follow the body in framing 'full': cost if wrong: misplaced props
- wardrobe ink lines (outlines, strokes that Peek draws in INK.ink) use the theme ink function; soft's ink is INK.ink so v1 bytes are unchanged; accent colours stay per the mock: fixes neon/mono contrast (Plan 1 T2 minor) · cost if wrong: none for v1
- T5's built-in collision rule also covers themes: defineTheme/registerPlugins reject built-in theme names (soft, bold, mono, neon, clay) and normalise custom colours via parseHex (Plan 1 T2 minors): cost if wrong: callers can't override built-in themes (they can register a new name)
- visor glow travel = 3 mock units × 3.4 = 10.2 frame units (brief's '×3 frame units' read in mock units; literal ±3.3 is invisible): cost if wrong: one constant
- scarf band half-width uses the body's half-width at the neck line (not the brief's eye-line min(sh.side,115)), and the necklace must not read as a grin: controller-confirmed on the contact sheet; a reasonable user expects wardrobe to sit on the body · cost if wrong: small geometry change
- props must not cover the face: the brief's fixed point (279,265) overlaps the right eye on round/wide shapes; place the prop beside the body (x from the body's half-width at the prop's y + clearance, y at/below the cheek line), clamped inside the frame; test no overlap with eye/brow/mouth boxes on all 15 shapes · controller-confirmed on the contact sheet · cost if wrong: prop position differs from the mock on some shapes
- held-prop placement bounds by the visible viewBox (−30..370) instead of the 340 frame: props on wide bodies shrank to 0.5–0.6 and read as specks on the fix-1 sheet · cost if wrong: props reach into the frame margin
- 'rays' excluded from the ai motif enum and dropped by parseLook (reserved for Aria): cost if wrong: one constant (RESERVED_MOTIFS)
- Plan 3 fix wave = C1, I1, I2, I3, I4, I5 + M1 (tier gate), M4, M5, M6, M7, M8, SwingSlot, missing plugin tests: C1/I4/I1/I2 hit Plans 4–5 immediately · cost if wrong: small diff
- M3 (Pose.swing shared mutable object must be copied per frame in Rig.frames) + Rig owning springsOf specs + a physics plugin in its tests → carried into Plan 4 Task 0's dispatch
- I6 + cosmetic deferrals (mustache mirroring, round-semicircle prop near crown, visor non-level eyes) + M2 memoisation are decided/fixed in Plan 6 before the golden freeze (Step 0 amended): cost if wrong: none before release

## 2026-10-17-04-adapters

- T3 updates the "main entry stays frozen" test deliberately to drop the React `Avatar` export from `@awflow/avatar` (moved to @awflow/avatar-react): spec §7.9 core never imports a framework · cost if wrong: none (unpublished)
- every adapter omits `style` from avatar options (CSS style prop) and pins with `version` (Plan 1 ruling): cost if wrong: none
- export frames() from the main entry (Plan 6 export + docs use it) and Rig from ./adapter only: cost if wrong: one export line
- <awf-avatar> keeps `attr="false"` → false (documented, Vue/Lit expectation): cost if wrong: deviates from strict HTML boolean convention
- <awf-avatar> uses a `label` attribute for the accessible name instead of observing the global `title` (which would also show a native host tooltip): cost if wrong: one attribute name
- Plan 4 fix wave = I1, I2, I3, I5 (rename the source condition to a private `awflow-src` used only by repo test/tsconfig configs), I6 (cap frames in core, shared LIMITS constants), I4 Plan-5 half (scratch-verify file: install resolves ONE @awflow/avatar realpath; else document tarball path) + minors: set() skips identity work for state-only patches; reactKey during identity change fires consistently (Svelte/React/Vue); bench real-run guards + loop p95 gate; group tests spy handle.lookAt; sideEffects:false; React 'use client' banner; svelte-package excludes tests: cost if wrong: larger diff
- I4 publish half → Plan 6 Task 5 amended: publish with `bun publish` (or packed tarballs), assert packed manifests contain no `workspace:` and no source condition: cost if wrong: none before publish

## 2026-10-17-05-awflow-migration

- Plan 5 local merge into agentic-flow Dev and docs Dev is pre-authorized by the owner's standing rule ("merge locally to Dev, no per-issue PRs"); no push: cost if wrong: local-only, reversible
- motionToProps keeps fx:true in every motion mode (lively/calm/off/reduced); only `animate` is gated: FX carry status (needs-you badge, sleeping, error), and the package principle is 'reduced motion cuts durations, never the pose'; overrides the brief's calm/off wording · cost if wrong: calm users see static badges
- new drafts write BOTH legacy avatar fields and `avatar.look` (dual write) so older app versions render shared agents; look omitted on no-match/shuffle: deviates from the brief's "store in avatar.look" only · cost if wrong: redundant fields
- studio picks do NOT mirror into legacy avatar fields (legacy fields kept, never overwritten; older app versions show the pre-edit look): mirroring would be partial and lossy · cost if wrong: old versions show stale look of edited agents
- routine-progress ring (#4f86f7) not implemented: no routine progress source exists; only the waiting (approval) ring ships, sourced from activityStore approval events · brief allows omitting when unknown · cost if wrong: one ring variant unused
- the waiting ring only shows for actionable approvals (pending, with a way to respond); auto-denied background 'approval' events keep their Activity semantics but never light the ring: no change to Activity behaviour · cost if wrong: none
- Task 6 does docs + the pre-merge i18n pass but NOT the local merge; the merges into agentic-flow Dev and Agentic-Flow-Doc Dev happen after Plan 5's final whole-branch review is clean: merging before the final gate would skip it · cost if wrong: none
- Calm differs from Lively by no pointer-following eyes and no streaming mouth pulses (pulses already lively-only); motionToProps gains follow:boolean, AgentCharacter gates gaze on it: makes the setting's copy true · cost if wrong: calm users lose pointer gaze
- I2 → new blank/template/team-draft agents write upgradeFace() v2 looks (new face set is the default) + docs wording fixed: owner asked for the new looks; cost if wrong: new agents look different from older ones (intended)
- I1 → app half only now (detail page draws from template document); card summaries need API memberSchema to pass bounded avatar.look: follow-up in Agentic-Flow-API after merge · cost if wrong: cards show pre-edit look until API follow-up
- I3 → adopt reviewer's static rule (animate only if size >= 28 or mood !== idle; still never): cost if wrong: tiny idle avatars stop breathing
- fix wave includes M1, M2, M3, M4, M6; M5 (seed jitter, legacy only) and M7 (accepted) stay deferred: cost if wrong: small persona jitter in previews
- Plan 5 fix wave runs concurrently with Plan 6 Task 5a: different repos (agentic-flow/Doc vs avatar), no shared files · cost if wrong: none
- marketplace detail seeds with template key (installed id is random, unknowable): persona jitter only · cost if wrong: tiny brow/cheek differences after install on hashed fields
- docs "Upgrade face" screenshot keeps existing capture (switch only shows for pre-new-face agents): cost if wrong: stale screenshot until re-captured

## 2026-10-17-06-export-docs-release

- Task 1 is skipped: executed as Plan 4 Task 0 · cost if wrong: none
- export LIMITS reuse core FRAME_LIMITS (maxFrames 600) plus export-only maxSize 1024 / maxSprite 400: one source of truth · cost if wrong: none
- the private `awflow-src` condition is stripped from packed manifests at pack time (prepack transform or publishConfig) so published exports contain only dist targets: the Plan 6 publish check asserts it · cost if wrong: harmless inert key
- Task 5 stops before Step 3 (npm publish) and before deploy (wrangler) to ask the owner: irreversible/outward · cost if wrong: none
- Task 5 Steps 0a+0 (cosmetics, memoisation, golden-v2 freeze) run first as 'Task 5a', before Tasks 2-4, so the export/site build on frozen bytes; Steps 1-3 run last: cost if wrong: none
- Step 0's homepage/repository URL replacement uses https://github.com/awflow/avatar (owner can change before publish, publish stop point covers it): cost if wrong: one-line edit
- Task 5a concern 1 rejected: prop scale floor 0.75 stays (an earlier fix already addressed props shrinking too far); round-semicircle wide-persona case must relocate the prop (lower beside the body / further out, within viewBox) instead of shrinking; golden sums regenerated after · cost if wrong: one more fix round
- owner authorised npm publish on 2026-10-17 (logged in as npm user 'awflow', owner of @awflow scope; @awflow/avatar name free): publish at Task 5 Step 3 after all gates, no further stop; site deploy (wrangler) still asks first · cost if wrong: an npm version can be deprecated but never reused
- accept upng-js → own APNG writer on fflate 0.8.3 (exact pin, avoids floating pako changing bytes): cost if wrong: small own encoder to maintain
- sprite total-pixel guard (RangeError) is required, not deferred: public API must fail with a named limit, not OOM · cost if wrong: one extra LIMITS key
- Task 3 fix round re-review done by controller (75-line diff; EPIPE pipe, -- sheet, duplicate-name ids verified by running the bin) instead of a re-review agent: cost if wrong: a CLI nit slips to final review
- site snippets follow the real API where the mock disagrees (defineTheme/plugin/ai/CLI, no Lottie, real wardrobe counts): mocks were illustrative · cost if wrong: copy edits
- Coming-from-Peek shows toSvg({style:'peek@1'}) + version={1} for components: matches the Plan 1 ruling that adapters do not take `style` · cost if wrong: none
- `[docs domain]` placeholder (SITE + wrangler.jsonc) stays until the deploy stop point, where the owner picks the domain: cost if wrong: one constant
- Task 4 fix round verified by controller (102-line diff, focus ring + radio pills screenshot, 0 em dashes): cost if wrong: a11y nit slips to final review
- repository/homepage URLs corrected to https://github.com/awflow/agent-avatar (the actual origin remote; awflow/avatar does not exist) and packageManager aligned to bun@1.3.14 (version used by gates + CI): controller commit 4014ae2 · cost if wrong: one-line edits
- ship 1.0.1 for changed packages only (element fix; core + export for CLI/engines/type minors); adapters stay 1.0.0 (they depend ^1.0.0): cost if wrong: versions diverge across packages
- fix wave = element build + runtime tarball smoke in release.ts/CI, mount test isolation, root README, CLI minors (size cap, -h/-v, warn/reject ignored --fps/--seconds), engines node>=20, readonly string[], CI permissions + Node 20 job + size.ts, README npx wording, browser init docs + resvg MPL credit; ops items listed for owner

## 2026-10-18 character plugins (1.1.0, spike/aria-character)

- spin pivots toward the body centre past 20 degrees of turn, for every face: static poses lean less, so goldens and parity hold; live and exported spins change, noted in the changelog · cost if wrong: a spin GIF exported with 1.0.x differs from 1.1.0
- character framing (`framing: 'full'`) fits the box swept by headroom, the highest hop (1.6 altitude units) and a whole spin (0.6 lift), centred, never above the built-in 0.8 scale: a character may draw smaller than a built-in face, never cut · cost if wrong: smaller mascots in full framing
- speech waves read `geom.speech`, else (characters only) a spot beside the mouth below the eyes; built-in faces keep their spot byte for byte · cost if wrong: none
- `focus` channel never joins the id (it follows from the activity) · cost if wrong: none
- `tint` reaches characters only, and only from an explicit `color`; a hashed colour never recolours a mascot · cost if wrong: none
- ai offers `character` only by registered names, and omits the axis when none is registered (an empty enum is not valid JSON Schema) · cost if wrong: none
- versions: core, export, vue, element to 1.1.0; react, svelte, solid stay 1.0.0 (they forward every option and their files are unchanged) · cost if wrong: one more patch
- Aria: Ember Mochi is the default mascot, Pip the Owlet an alternative look chosen in app settings (owner)

## Open follow-ups

- Agentic-Flow-API: `memberSchema` / `templateMembers` should pass a bounded `avatar.look` so marketplace cards show the edited look.
- Next release: package READMEs and `homepage` point at https://awflow.github.io/agent-avatar/.
- CLI: `readFd` retries `EAGAIN` in a tight loop on non-blocking stdin; `>&-` (closed fd 1) still exits 0.
- Docs: Vue, Solid, HTML and element snippets are not typechecked; native radio pickers lack Home/End.
- Perf: `memoOf` has→get, `bodyHalf` keyed on continuous y.
- npm ops (owner, 2FA): deprecate the `0.0.0-stage` placeholder versions; consider reserving the unscoped `awflow-avatar` name.
- AWFlow: preview seeds use template/seat keys, so hashed persona details can shift slightly after install; one tautological assertion in the LookStudio colour test.
