/*
 * Perf budget (spec §9): 100 animated 48 px avatars with mixed activities in
 * a real Chromium page for 10 s. Pass = p95 frame time <= 16.7 ms and p95
 * of the shared loop's own callback <= 16.7 ms (the frame p95 alone is
 * quantised to the display's vsync), on a real run: exactly `count` svgs,
 * every one inside the viewport (off-screen avatars pause), and at least
 * 50 loop callbacks per second recorded.
 *
 *   bun run build && bun packages/avatar/scripts/bench.ts [--seconds 10]
 *     [--count 100] [--size 48] [--headed] [--json] [--profile]
 *
 * Frame time is the delta between consecutive requestAnimationFrame
 * timestamps in the page. The page also times the shared loop's own rAF
 * callback (measure, rig step, draw, attribute writes) and records long
 * tasks, so a miss can be told apart from a slow machine. A baseline run
 * with no avatars shows what the browser alone gives on this machine.
 * `--profile` also samples the CPU during the run and prints the functions
 * with the most self time, per frame.
 *
 * It serves the built dist (not the sources): run `bun run build` first.
 * Not part of `bun run test`.
 */
import { existsSync } from 'node:fs'
import { arch, cpus, platform, release, totalmem } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const BUDGET_MS = 16.7

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`)
  const v = i > 0 ? Number(process.argv[i + 1]) : Number.NaN
  return Number.isFinite(v) ? v : fallback
}
const SECONDS = arg('seconds', 10)
const COUNT = arg('count', 100)
const SIZE = arg('size', 48)
const HEADED = process.argv.includes('--headed')
const JSON_OUT = process.argv.includes('--json')
const PROFILE = process.argv.includes('--profile')

const dist = join(import.meta.dir, '..', 'dist')
if (!existsSync(join(dist, 'adapter.js'))) {
  console.error('bench: packages/avatar/dist is missing, run `bun run build`')
  process.exit(2)
}

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>bench</title>
<style>
  body { margin: 0; background: #fff }
  #grid { display: grid; grid-template-columns: repeat(auto-fill, ${SIZE}px);
    gap: 4px; padding: 8px }
  #grid > div { width: ${SIZE}px; height: ${SIZE}px }
</style></head>
<body><div id="grid"></div>
<script>
  // time every rAF callback but the bench's own: that is the shared loop
  const raf = window.requestAnimationFrame.bind(window)
  window.__loop = []
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      if (cb.__bench) return cb(t)
      const s = performance.now()
      cb(t)
      window.__loop.push(performance.now() - s)
    })
  window.__long = []
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__long.push(e.duration)
    }).observe({ type: 'longtask', buffered: true })
  } catch {}
</script>
</body></html>`

// Cross-origin isolation lifts the browser's timer coarsening (100 us
// otherwise): at 100 us a steady 60 Hz frame reads as 16.6, 16.7 or 16.8 ms
// and the p95 would flip around the budget on rounding alone.
const isolated = {
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-embedder-policy': 'require-corp',
}
const html = { ...isolated, 'content-type': 'text/html; charset=utf-8' }
const js = { ...isolated, 'content-type': 'text/javascript; charset=utf-8' }

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = new URL(req.url).pathname
    if (path === '/') return new Response(PAGE, { headers: html })
    if (path.startsWith('/dist/') && !path.includes('..')) {
      const file = Bun.file(join(dist, path.slice('/dist/'.length)))
      if (await file.exists()) return new Response(file, { headers: js })
    }
    return new Response('not found', { status: 404 })
  },
})

type Run = {
  frames: number[]
  loop: number[]
  long: number[]
  /** svgs in the grid, and how many of them reach outside the viewport */
  svgs: number
  outside: number
  profile?: { fn: string; ms: number }[]
}

type CpuProfile = {
  nodes: {
    id: number
    callFrame: { functionName: string; url: string; lineNumber: number }
  }[]
  samples: number[]
  timeDeltas: number[]
}

/* self time by function, heaviest first */
function selfTime(p: CpuProfile): { fn: string; ms: number }[] {
  const byId = new Map(p.nodes.map((n) => [n.id, n.callFrame]))
  const total = new Map<string, number>()
  p.samples.forEach((id, i) => {
    const f = byId.get(id)!
    const where = f.url ? ` ${f.url.split('/').pop()}:${f.lineNumber + 1}` : ''
    const key = `${f.functionName || '(anonymous)'}${where}`
    total.set(key, (total.get(key) ?? 0) + (p.timeDeltas[i] ?? 0) / 1000)
  })
  return [...total].map(([fn, ms]) => ({ fn, ms })).sort((a, b) => b.ms - a.ms)
}

/* mounts `count` avatars, warms up a second, then records `seconds` */
async function measure(count: number, seconds: number): Promise<Run> {
  const browser = await chromium.launch({ headless: !HEADED })
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'no-preference',
    })
    await page.goto(`http://localhost:${server.port}/`)
    const cdp =
      PROFILE && count ? await page.context().newCDPSession(page) : null
    if (cdp) {
      await cdp.send('Profiler.enable')
      await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
      await cdp.send('Profiler.start')
    }
    const run: Run = await page.evaluate(
      async ({ count, seconds, size }) => {
        if (!crossOriginIsolated) throw new Error('bench: page not isolated')
        const { mount, ACTIVITIES } = await import('/dist/adapter.js' as any)
        const kinds = Object.keys(ACTIVITIES)
        const grid = document.getElementById('grid')!
        for (let i = 0; i < count; i++) {
          const el = document.createElement('div')
          grid.appendChild(el)
          mount(el, {
            name: `Agent ${i}`,
            size,
            animate: true,
            activity: kinds[i % kinds.length],
          })
        }
        const w = window as any
        const frame = (fn: (t: number) => void) => {
          const cb = Object.assign(fn, { __bench: true })
          requestAnimationFrame(cb)
        }
        // warm up: the first frames compile and lay out
        await new Promise((r) => setTimeout(r, 1000))
        const svgs = Array.from(grid.querySelectorAll('svg'))
        const outside = svgs.filter((svg) => {
          const r = svg.getBoundingClientRect()
          return (
            r.width === 0 ||
            r.left < 0 ||
            r.top < 0 ||
            r.right > innerWidth ||
            r.bottom > innerHeight
          )
        }).length
        w.__loop.length = 0
        w.__long.length = 0
        const frames: number[] = []
        await new Promise<void>((done) => {
          let prev = -1
          let end = 0
          const step = (t: number) => {
            if (prev < 0) end = t + seconds * 1000
            else frames.push(t - prev)
            prev = t
            if (t < end) frame(step)
            else done()
          }
          frame(step)
        })
        return {
          frames,
          loop: [...w.__loop],
          long: [...w.__long],
          svgs: svgs.length,
          outside,
        }
      },
      { count, seconds, size: SIZE },
    )
    if (cdp) {
      const { profile } = await cdp.send('Profiler.stop')
      run.profile = selfTime(profile as CpuProfile)
    }
    return run
  } finally {
    await browser.close()
  }
}

function stats(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  const q = (p: number) =>
    s.length ? s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]! : 0
  const mean = s.reduce((a, b) => a + b, 0) / (s.length || 1)
  return {
    n: s.length,
    mean: +mean.toFixed(2),
    p50: +q(0.5).toFixed(2),
    p95: +q(0.95).toFixed(2),
    p99: +q(0.99).toFixed(2),
    max: +(s[s.length - 1] ?? 0).toFixed(2),
  }
}

try {
  const base = await measure(0, Math.min(3, SECONDS))
  const run = await measure(COUNT, SECONDS)
  const version = chromium.executablePath().match(/chromium[^/]*-\d+/)?.[0]
  const report = {
    machine: {
      platform: `${platform()} ${release()} ${arch()}`,
      cpu: `${cpus()[0]?.model ?? 'unknown'} x${cpus().length}`,
      memory: `${Math.round(totalmem() / 2 ** 30)} GB`,
      browser: `${version ?? 'chromium'} (${HEADED ? 'headed' : 'headless'})`,
      bun: Bun.version,
    },
    setup: { count: COUNT, size: SIZE, seconds: SECONDS },
    baseline: { frames: stats(base.frames) },
    frames: stats(run.frames),
    loop: stats(run.loop),
    longTasks: { count: run.long.length, max: Math.max(0, ...run.long) },
    budget: BUDGET_MS,
  }
  // a run that did not measure what it claims is a failure, not a pass
  const guards: string[] = []
  if (run.svgs !== COUNT) guards.push(`${run.svgs} svgs, expected ${COUNT}`)
  if (run.outside)
    guards.push(`${run.outside} svgs outside the viewport (they would pause)`)
  if (run.loop.length < SECONDS * 50)
    guards.push(
      `${run.loop.length} loop callbacks, expected at least ${SECONDS * 50}`,
    )
  if (report.loop.p95 > BUDGET_MS)
    guards.push(`loop p95 ${report.loop.p95} ms over ${BUDGET_MS} ms`)
  const pass = report.frames.p95 <= BUDGET_MS && guards.length === 0
  const checks = { svgs: run.svgs, outside: run.outside, guards }
  if (JSON_OUT)
    console.log(JSON.stringify({ ...report, checks, pass }, null, 2))
  else {
    const f = (s: ReturnType<typeof stats>) =>
      `n=${s.n} mean=${s.mean} p50=${s.p50} p95=${s.p95} p99=${s.p99} max=${s.max} ms`
    console.log(`machine   ${Object.values(report.machine).join(' · ')}`)
    console.log(`setup     ${COUNT} avatars · ${SIZE} px · ${SECONDS} s`)
    console.log(`baseline  frames ${f(report.baseline.frames)}`)
    console.log(`frames    ${f(report.frames)}`)
    console.log(`loop      ${f(report.loop)}`)
    console.log(
      `long      ${report.longTasks.count} long tasks, max ${report.longTasks.max.toFixed(1)} ms`,
    )
    console.log(
      `checks    ${run.svgs} svgs · ${run.outside} outside the viewport · ${run.loop.length} loop callbacks`,
    )
    for (const g of guards) console.log(`  guard failed: ${g}`)
    if (run.profile) {
      const n = (run.frames.length || 1) + 60 // the warm-up second too
      console.log('profile   self time per frame (ms), heaviest first')
      for (const { fn, ms } of run.profile.slice(0, 15))
        console.log(`  ${(ms / n).toFixed(3).padStart(7)}  ${fn}`)
    }
    console.log(
      `${pass ? 'PASS' : 'FAIL'}      frames p95 ${report.frames.p95} ms · loop p95 ${report.loop.p95} ms (budget ${BUDGET_MS} ms)`,
    )
  }
  process.exitCode = pass ? 0 : 1
} finally {
  server.stop(true)
}
