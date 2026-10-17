# Plan 2 — State & motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the activity layer (10 activities blended with Peek's 11 expressions), an FX layer, one-shot reactions, accessory physics, lip-sync hooks and group gaze to the core, both in static `toSvg` and in the live rig.

**Architecture:** Peek's `Live.paint()` already calls `draw(who, pose, opts)` every frame and writes only changed attributes, so all motion is expressed as new `Pose` fields that `draw()` reads. The live tree's structure must not change between frames: FX use a fixed pool of keyed nodes, physics only changes transforms. Pure maths lives in small modules (`activity.ts`, `reactions.ts`, `physics.ts`, `fx.ts`) with unit tests; `Live` only wires them.

**Tech Stack:** as Plan 1; `@happy-dom/global-registrator` (devDependency of `packages/avatar` only) for `Live` tests.

**Spec:** `docs/superpowers/specs/2026-10-17-awflow-avatar-design.md` (§7.4–7.6)

## Global Constraints

- Roadmap shared constraints apply.
- `version: 1` output with no new options stays byte-identical (golden v1 snapshot must keep passing in every task).
- One shared rAF loop (Peek's `run()/tick()`); no per-avatar timers. Reduced motion: durations go to zero, poses still apply; loops and FX motion freeze at the static phase.
- Static phase for `toSvg` and first paint: `t = 0.9` s.
- FX pool size: 24 nodes keyed `fx.0` … `fx.23`, drawn in frame space above the body; in non-live draws unused pool nodes are pruned.

## Review Focus

1. **Rapid state churn** — an app flipping `activity` every few ms (streaming tokens toggling thinking/speaking) must not jitter or leak; expected: springs retarget smoothly, no unbounded queues. Test in Task 2 (`setActivity` 500× in 1 s keeps `queue.length <= 8`).
2. **Reaction spam** — `react()` called repeatedly while one is running; expected: the new one replaces the old (no stacking explosion), state returns to the activity afterwards. Test in Task 3.
3. **Unknown names from untyped callers** — `activity: 'typing'`, `react('dance')`; expected: ignored (activity stays/falls back to `idle`, react is a no-op), never throws. Tests in Tasks 1 and 3.
4. **Gaze target removed** — `lookAt(other)` then `other.destroy()`; expected: gaze falls back to the avatar's own gaze, no exception. Test in Task 6.
5. **Huge dt after a background tab** — a 10 s frame gap; expected: physics and springs stay finite (dt clamped to 0.05 s as Peek does). Test in Task 4.

---

### Task 1: Activity table and blending (static)

**Files:**
- Create: `packages/avatar/src/activity.ts`
- Modify: `src/tables.ts` (export `ACTIVITIES` list type), `src/draw.ts` (`Pose` fields), `src/svg.ts` (`activity` option), `src/index.ts`, `src/adapter.ts`
- Test: `packages/avatar/src/activity.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Activity = 'idle'|'listening'|'thinking'|'working'|'speaking'|'waiting'|'done'|'error'|'sleeping'|'offline'
  export const ACTIVITIES: Record<Activity, { set: Partial<Channels>; fx: FxKind[]; lockGaze: boolean }>
  export function blend(expression: Expression, activity: Activity): Channels
  export function activityLoop(activity: Activity, t: number, phase: number): Partial<Channels>
  ```
- `Pose` gains `activity: Activity`, `t: number`, `wob: number`, `fx: FxKind | null`, `fxP: number`, `voice: number` (0..1, mouth open from lip-sync, −1 = none). `restPose(who, expression, gaze?, activity = 'idle')` fills `t: 0.9, wob: 0, fx: null, fxP: 0, voice: -1` and applies `blend` + `activityLoop(activity, 0.9, 0)` (except `alt`/`x`).
- `ACTIVITIES.set` values (channel units = Peek's tables):
  - listening `{lid:0, eyeS:1.06, browY:-4, rot:5, mw:0.5, mb:0.3, gx:-0.3}` fx `['rings']`
  - thinking `{gx:-0.35, gy:-0.6, browAsym:7, browArch:0.8, mw:0.45, mt:-0.1, mb:0.15, mk:6, lid:0.05}` fx `['bubbles']` lockGaze
  - working `{gy:0.35, browY:2, lid:0.22, mw:0.5, mt:0, mb:0.12, browArch:0.2}` fx `['spinner']` lockGaze
  - speaking `{lid:0.05, browY:-2, mw:0.8}` fx `['waves']`
  - waiting `{lid:0, eyeS:1.06, browY:-6, browArch:0.9, gx:0, gy:0, mw:0.5, mt:-0.2, mb:0.25}` fx `['ask']` lockGaze
  - done `{lid:0, lower:0.45, shine:1, browY:-5, browArch:1, mw:1, mb:1, blush:1, hair:0.6}` fx `['sparkles']`
  - error `{lid:0.18, browTilt:14, browY:2, browArch:0, mw:0.7, mt:-0.35, mb:-0.15, my:3, gy:0.3}` fx `['sweat']`
  - sleeping `{lid:1, lidTilt:4, gy:0.5, browY:5, browArch:0.15, mw:0.35, mt:-0.2, mb:0.3, alt:-0.9, rot:-3, hair:-1}` fx `['zzz']` lockGaze
  - offline `{lid:0.62, gy:0.4, browY:3, mw:0.4, mt:0, mb:0.05, dim:1}` fx `[]` lockGaze
  - idle `{}` fx `[]`
- `blend` rule: start from `EXPRESSIONS[expression]`, overlay `set`; when expression ≠ normal and activity ≠ idle, `browTilt, browArch, blush, lidTilt` = mean of expression and activity values (activity value defaults to the expression's), and if `set.mb` is undefined keep the expression's `mt`/`mb`.
- `activityLoop` (additive, `s = sin`): idle/listening/waiting/done/speaking/error `sy += 0.012·s(2.1t+ph)`; thinking `gx 0.28·s(0.9t+ph)`, `rot 2·s(0.7t)`, `sy 0.01·s(1.6t)`; working `gx 0.55·s(3.1t+ph)`, `alt 0.05·|s(9t)|`, `rot 1.2·s(4.5t)`; speaking `m = 0.5+0.5·s(13t+ph)·s(3.7t+1.3)`, `mb 0.85m`, `mt −0.35m`, `alt 0.03·s(6t)`; listening `rot 1.5·s(1.3t)`; waiting `alt 0.16·|s(3.4t)|`, `sy 0.02·s(6.8t)`; done hop in the first 30% of every 2.4 s (`alt 0.9·s(πq)`, squash `sy −0.06` then `0.03`); error shiver in the first 0.5 s of every 2.2 s (`x 1.1·s(60p)·(1−p/0.5)`, x in Peek frame units ×3.4); sleeping `sy 0.03·s(1.1t+ph)`, `alt 0.06·s(1.1t+ph)`.
- `AvatarOptions` gains `activity?: Activity` (unknown → `idle`).

- [ ] **Step 1: Write the failing tests:** `blend('normal','idle')` deep-equals `EXPRESSIONS.normal`; `blend('happy','working').browArch === (1 + 0.2) / 2`; `blend('sad','thinking').mb === 0.15` (thinking sets mb); `blend('sad','speaking').mb === EXPRESSIONS.sad.mb` and `.mt === EXPRESSIONS.sad.mt` (speaking sets no mouth); `activityLoop` returns finite values for every activity at t ∈ {0, 0.9, 1000}; `toSvg('Linh', {activity: 'typing' as any}) === toSvg('Linh')`; every activity × 15 faces renders clean; v1 golden unchanged.
- [ ] **Step 2:** Run `bun test src/activity.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `activity.ts`, the `Pose` fields and `restPose`/`settle` plumbing.
- [ ] **Step 4:** Run `bun test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(core): activity layer with expression blending`.

### Task 2: FX layer and `Live.setActivity`

**Files:**
- Create: `packages/avatar/src/fx.ts`
- Modify: `src/draw.ts` (FX pool group), `src/animate.ts` (`setActivity`, loops, ring pulse)
- Test: `packages/avatar/src/fx.test.ts`, `packages/avatar/src/live.test.ts` (new, happy-dom)

**Interfaces:**
- Produces:
  ```ts
  export type FxKind = 'bubbles'|'zzz'|'sparkles'|'rings'|'spinner'|'waves'|'ask'|'sweat'|'hearts'|'confetti'
  export type FxShape = { d: string; fill: string; stroke: string; strokeWidth: number; opacity: number; transform: string }
  export function fxShapes(kind: FxKind, t: number, p: number, anchor: { headX: number; headTop: number; side: number; eyeY: number; mouthY: number }, ink: string, onDark: boolean): FxShape[]
  // Live
  setActivity(activity: Activity): void
  ```
- Drawing references (100-unit prototype ×3.4): bubbles 3 circles r `(1.4+1.1i)` rising up-right with phase `(0.9t+i/3)%1`; zzz 3 "z" strokes drifting up-right, opacity `sin(πp)`; sparkles 4-point stars at 4 head-relative points twinkling `max(0, sin(4t+1.7i))`; rings 2 arcs left of the face growing r 6→14, fading; spinner track circle r 4.4 + 110° arc rotating 300°/s in `#F08A24`; waves 2 arcs right of the mouth pulsing `0.5+0.5·sin(9t)`; ask = orange `#F08A24` speech bubble with a white "?" bobbing `1.4·sin(3.4t)`; sweat = blue drop `#7DB7E8` sliding down; hearts 3 `#E5677A` hearts rising with reaction progress; confetti 16 rects in 5 colours falling with progress (seeded, deterministic).
- `AvatarOptions`/`DrawOptions` gain `fx?: boolean | string` — `false` hides all FX, `true`/omitted draws the activity and reaction FX, a string additionally draws that registered FX (plugins, Plan 3).
- `draw()` puts `fxShapes` for `ACTIVITIES[pose.activity].fx` plus `pose.fx` (reaction) into pool nodes `fx.0..fx.23` in order; extra shapes beyond 24 are dropped. LOD: no FX below 44 px except `ask`.
- `Live.setActivity(a)`: retargets springs to `blend(expression, a)` using Peek's spring constants (no choreography queue), sets `pose.activity`; `paint()` passes `t = clock`, and the activity loop is added to `out` each `step`. The ring with `pulse` gets opacity `0.55 + 0.45·sin(5t)`.

- [ ] **Step 1: Write the failing tests:**
  - `fxShapes` returns ≤ 24 finite shapes for every kind at t ∈ {0, 0.9, 7.3} and p ∈ {0, 0.5, 1}.
  - `pool is stable`: `draw(who, pose, {…opts, live: true})` has exactly the 24 `fx.*` keys for every activity; with `live: false` and `activity: 'idle'` it has none.
  - `static phase`: `toSvg('Linh', {activity: 'thinking'})` contains 3 bubble paths; with `fx: false` it contains none.
  - `live.test.ts` (happy-dom, fake rAF): mounting a `Live` on `toSvg` output and calling `setActivity('working')` then stepping 60 frames changes `gx` over time and keeps node count constant; calling `setActivity` 500 times within 1 simulated second leaves `queue.length <= 8`.
- [ ] **Step 2:** Run `bun test src/fx.test.ts src/live.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `fx.ts`, the pool in `draw()`, and `Live.setActivity`.
- [ ] **Step 4:** Run `bun test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(core): FX layer and live activities`.

### Task 3: Reactions

**Files:**
- Create: `packages/avatar/src/reactions.ts`
- Modify: `src/animate.ts` (`react`), `src/draw.ts` (right-eye wink channel)
- Test: `packages/avatar/src/reactions.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Reaction = 'nod'|'shake'|'wink'|'hop'|'spin'|'shiver'|'gasp'|'love'|'giggle'|'celebrate'
  export const REACTIONS: Record<Reaction, { dur: number; at: (p: number) => Partial<Channels> & { winkR?: number }; fx?: FxKind }>
  // Live
  react(name: Reaction): void
  ```
- Values (p ∈ 0..1): nod 0.9 s `gy 0.5·s(2πp)`, `alt −0.18·|s(2πp)|`; shake 0.9 s `x 4·s(6πp)(1−p)` (×3.4 frame units), `gx 0.5·s(6πp)(1−p)`; wink 0.7 s `winkR s(πp)`, `mb 0.5·s(πp)`, `browAsym −6·s(πp)`; hop 0.8 s `alt 1.6·s(πp)`, `sy −0.08`/`sx 0.06` in the first and last 12% else `sy 0.04`/`sx −0.02`; spin 1.1 s `rot 360·easeInOutQuad(p)`, `alt 0.6·s(πp)`; shiver 1 s `x 1.4·s(90p)(1−p)`, `sy −0.02`, `lid 0.15`, `browTilt 10`; gasp 1.1 s `k = s(min(1,2.5p)·π/2)·(1−max(0,(p−0.7)/0.3))`: `eyeS 0.25k, mt −0.6k, mb 0.7k, browY −12k, alt 0.3k, pupil −0.3k`; love 1.8 s `blush 1 (max), lower 0.4·s(πp), mb 0.5·s(πp), alt 0.2·s(πp)` fx hearts; giggle 1.2 s `rot 6·s(8πp)(1−p), lower 0.45·s(πp), mb 0.8·s(πp), blush 0.8`; celebrate 1.8 s `alt 1.3·|s(2πp)|(1−p/2), lower 0.45, mb 1, blush 1` fx confetti.
- Deltas are additive on top of springs (blush uses max). A new `react()` replaces the running one. Reduced motion: no-op. `Channels` gains `winkR` (right-eye lid, max with `lid`).

- [ ] **Step 1: Write the failing tests:** every `REACTIONS[r].at(p)` finite for p ∈ {0, .25, .5, .75, 1} and returns ~0 deltas at p = 1 for nod/shake/wink/hop/gasp; `live.react('dance' as any)` does not throw and changes nothing; two `react('hop')` 0.1 s apart leave one active reaction; after `dur` the pose equals the activity pose (± 1e-3 once springs settle); reduced motion → `react` no-op.
- [ ] **Step 2:** Run `bun test src/reactions.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `bun test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(core): reactions`.

### Task 4: Accessory physics

**Files:**
- Create: `packages/avatar/src/physics.ts`
- Modify: `src/animate.ts` (feed body acceleration, write `pose.wob`), `src/draw.ts` (apply `wob` to the trait's existing lag logic and to physics-enabled wearables)
- Test: `packages/avatar/src/physics.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Swing = { angle: number; vel: number }
  export type SwingSpec = { stiffness: number; damping: number; maxSwing: number }   // ω, ζ, degrees
  export const DEFAULT_SWING: SwingSpec = { stiffness: 10, damping: 0.18, maxSwing: 28 }
  export function stepSwing(s: Swing, accel: { x: number; y: number; rot: number }, dt: number, spec?: SwingSpec): Swing
  ```
- Excitation `−(0.35·ax + 0.25·ay + 0.12·arot)` (frame units/s², deg/s²); `dt` clamped to 0.05; result angle clamped to ±maxSwing. `Live` keeps one `Swing`, computes body acceleration from successive `x`, `alt·R`, `rot`, and passes `pose.wob = angle`. Wearables declare physics in Plan 3; in this task the sprout (Peek) and the trait use `wob` (sprout rotates by `wob`, trait by `0.6·wob` on top of Peek's lag).

- [ ] **Step 1: Write the failing tests:** a single impulse decays below 0.5° within 3 s; angle never exceeds `maxSwing`; `stepSwing` with `dt = 10` returns finite values (clamped); zero acceleration from rest stays at 0.
- [ ] **Step 2:** Run `bun test src/physics.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement and wire into `Live`.
- [ ] **Step 4:** Run `bun test`. Expected: PASS; v1 golden unchanged (static `wob = 0`).
- [ ] **Step 5:** Commit `feat(core): accessory physics`.

### Task 5: Lip-sync hooks

**Files:**
- Modify: `packages/avatar/src/animate.ts`, `src/draw.ts` (mouth reads `pose.voice`)
- Test: `packages/avatar/src/live.test.ts`

**Interfaces:**
- Produces on `Live`:
  ```ts
  setVoice(source: (() => number) | null): void   // called every frame, returns 0..1
  pulse(strength?: number): void                  // one token/chunk: opens the mouth, decays over 120 ms
  ```
- When `activity === 'speaking'` and a voice source or recent pulse exists, `pose.voice = clamp(level, 0, 1)` replaces the built-in flap: `mb += 0.85·voice`, `mt −= 0.35·voice`. Without either, `voice = −1` and the Task 1 loop runs. A source returning `NaN`/out-of-range is clamped/treated as 0.

- [ ] **Step 1: Write the failing tests:** with `setVoice(() => 1)` the mouth opening (mb − mt) after 10 frames is greater than with `() => 0`; `pulse()` then 200 ms of frames returns to the closed value; `setVoice(() => NaN)` keeps the SVG finite; outside `speaking` the voice has no effect.
- [ ] **Step 2:** Run `bun test src/live.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `bun test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(core): lip-sync hooks`.

### Task 6: Group gaze

**Files:**
- Modify: `packages/avatar/src/animate.ts`
- Test: `packages/avatar/src/live.test.ts`

**Interfaces:**
- Produces on `Live`:
  ```ts
  lookAt(target: Live | Element | null): void   // null = back to own gaze
  readonly element: SVGSVGElement               // for others to measure
  ```
- Each frame, when a target is set and the activity does not lock gaze, the gaze target is the target's eye centre (measured with `getBoundingClientRect`, cached per frame as Peek does for the pointer), mapped exactly like Peek's pointer path; a destroyed target or detached element clears the target.

- [ ] **Step 1: Write the failing tests:** two Lives placed left/right (stub rects): A `lookAt(B)` → A's `gx > 0.3` after settling; B `destroy()` → A's gaze returns to its base without throwing; `activity: 'thinking'` ignores `lookAt`.
- [ ] **Step 2:** Run `bun test src/live.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `bun test && bun run build && bun run check-types`. Expected: PASS / exit 0.
- [ ] **Step 5:** Commit `feat(core): group gaze`.
