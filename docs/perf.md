# Performance

The budget (spec §9): **100 animated 48 px avatars with mixed activities,
in a real Chromium page, for 10 s. Pass = p95 frame time ≤ 16.7 ms.**

```
bun run build
bun packages/avatar/scripts/bench.ts            # the budget run
bun packages/avatar/scripts/bench.ts --profile  # plus CPU self time per frame
bun packages/avatar/scripts/bench.ts --count 300 --seconds 5 --json
```

The bench serves the built `dist` from a local `Bun.serve` and drives
Chromium through Playwright (`playwright` 1.64.1, Chromium revision 1248,
headless). It mounts the avatars with the core `mount()` in an on-screen grid
(the loop pauses off-screen avatars, so all of them are visible), cycles
through every activity, warms up for one second and then records:

- **frames**: deltas between consecutive `requestAnimationFrame` timestamps.
- **loop**: the duration of the shared loop's own rAF callback (layout
  reads, rig steps, drawing and attribute writes), timed by wrapping
  `requestAnimationFrame` in the page.
- **long tasks**: `PerformanceObserver` `longtask` entries.
- **baseline**: the same page with no avatars, for what the browser alone
  gives on the machine.

The page is cross-origin isolated (COOP/COEP headers). Without it Chromium
coarsens timers to 100 µs, and a perfectly steady 60 Hz frame reads as 16.6,
16.7 or 16.8 ms, so the p95 flipped around the budget on rounding alone.

The bench is a script, not part of `bun run test`. It exits 0 on a pass, 1 on
a miss and 2 when `dist` is missing.

## Results

2026-10-17 · Apple M2 Pro (10 cores) · 16 GB · macOS (Darwin 25.5.0, arm64)
· Chromium 1248 headless · Bun 1.3.14. Three consecutive runs:

| run | frames p50 | frames p95 | frames p99 | frames max | loop mean | loop p95 | loop max | long tasks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 16.66 | **16.67** | 16.67 | 16.67 | 6.13 | 6.86 | 8.52 | 0 |
| 2 | 16.66 | **16.67** | 16.67 | 16.67 | 6.16 | 6.88 | 8.97 | 0 |
| 3 | 16.66 | **16.67** | 16.67 | 16.67 | 6.14 | 6.69 | 8.14 | 0 |

All times in ms. Baseline (no avatars): p50 16.66, p95 16.67, max 16.67.
601 frames in 10 s, none dropped. **PASS**: p95 16.67 ms ≤ 16.7 ms.

### Where the loop's time goes

`--profile`, self time per frame, 100 avatars:

| ms / frame | what |
| --- | --- |
| 2.58 | `write`: attribute writes onto the DOM (`animate.ts`) |
| 2.2 | drawing the tree for the pose (`draw` and its helpers, `tree`, `depth`) |
| 0.5 | rig stepping (`step`, `current`, `zero`) |
| 0.23 | garbage collection |
| 5.4 | `(program)`: the browser's own style, layout and paint of 100 svgs |

The loop costs about 60 µs per avatar per frame on this machine, so the
budget leaves roughly 10 ms of headroom here. It scales linearly: at 300
avatars the loop takes about 19 ms a frame and the page drops to about
23 fps (p95 frame 50 ms). A machine three times slower than an M2 Pro would sit near the
budget at 100 avatars; the attribute writes are the first place to look.
