/*
 * The awflow-avatar command line, as a function. Plain Node >= 20, Node
 * built-ins only, run against the built `dist/`. `awflow-avatar.mjs` calls it
 * with the process; `@awflow/avatar-export`'s bin calls it with the export
 * package already in hand.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  ACTIVITIES,
  AXES,
  EXPRESSIONS,
  FRAME_LIMITS,
  LISTS,
  THEMES,
  toSvg,
} from '../dist/index.js'

const VERSION = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version

const HINT = 'Install @awflow/avatar-export for --png/--gif/--sprite'
const FRAMES = ['ink', 'bone', 'paper', 'none', 'theme']
const FRAMINGS = ['peek', 'full']
const MAX_SHEET = 400
// the silhouette is --shape; --face would be ambiguous between v1 and v2
const AXIS_FLAGS = AXES.filter((a) => a !== 'face')

const USAGE = `awflow-avatar: deterministic SVG avatars from a name

Usage:
  awflow-avatar <name> [options]        SVG on stdout
  awflow-avatar sheet <file|-> [options]  names, one per line, as one SVG grid
  After --, every argument is a name: awflow-avatar -- sheet draws "sheet".

Options:
  --theme <t>        ${Object.keys(THEMES).join(' | ')}
  --shape <s>        ${LISTS.face.join(' | ')}
  --expression <e>   ${Object.keys(EXPRESSIONS).join(' | ')}
  --activity <a>     ${Object.keys(ACTIVITIES).join(' | ')}
  --framing <f>      ${FRAMINGS.join(' | ')}
  --frame <f>        ${FRAMES.join(' | ')}
  --size <n>         pixels, 0 or more
  --dress            let the name pick the wardrobe too
  --${AXIS_FLAGS.join(' <v>, --')} <v>
                     override one hashed axis (color also takes #rrggbb)
  --png <n>          PNG, n pixels square (needs @awflow/avatar-export)
  --gif <n>          animated GIF, n pixels square (same), with --fps <n>
                     and --seconds <n>
  --sprite           sprite sheet PNG, tiles --size pixels (default 256)
  --version          print the version
  --help             print this help
`

class Usage extends Error {}
const fail = (m) => {
  throw new Usage(m)
}

const oneOf = (flag, v, list) =>
  list.includes(v)
    ? v
    : fail(`--${flag}: "${v}" is not one of ${list.join(', ')}`)
const num = (flag, v, { min = 0, whole = false } = {}) => {
  const n = v.trim() === '' ? Number.NaN : Number(v)
  if (!Number.isFinite(n) || n < min || (whole && !Number.isInteger(n)))
    fail(
      `--${flag}: "${v}" must be ${whole ? 'a whole number' : 'a number'} of ${min} or more`,
    )
  return n
}

const VALUE = new Set([
  'theme',
  'shape',
  'expression',
  'activity',
  'framing',
  'frame',
  'size',
  'png',
  'gif',
  'fps',
  'seconds',
  ...AXIS_FLAGS,
])
const BOOLEAN = new Set(['dress', 'sprite', 'help', 'version'])

/** argv to { positionals, opts (AvatarOptions), flags (the rest) }. */
function parse(argv) {
  const positionals = []
  const opts = {}
  const flags = {}
  let rest = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (rest || !a.startsWith('--')) {
      positionals.push(a)
      continue
    }
    if (a === '--') {
      rest = true
      continue
    }
    const eq = a.indexOf('=')
    const flag = a.slice(2, eq < 0 ? undefined : eq)
    if (BOOLEAN.has(flag)) {
      if (eq >= 0) fail(`--${flag} takes no value`)
      flags[flag] = true
      continue
    }
    if (!VALUE.has(flag)) fail(`unknown option --${flag}, try --help`)
    let v
    if (eq >= 0) v = a.slice(eq + 1)
    else {
      v = argv[++i]
      if (v === undefined) fail(`--${flag} needs a value`)
    }
    switch (flag) {
      case 'theme':
        opts.theme = oneOf(flag, v, Object.keys(THEMES))
        break
      case 'shape':
        opts.shape = oneOf(flag, v, LISTS.face)
        break
      case 'expression':
        opts.expression = oneOf(flag, v, Object.keys(EXPRESSIONS))
        break
      case 'activity':
        opts.activity = oneOf(flag, v, Object.keys(ACTIVITIES))
        break
      case 'framing':
        opts.framing = oneOf(flag, v, FRAMINGS)
        break
      case 'frame':
        opts.frame = oneOf(flag, v, FRAMES)
        break
      case 'size':
        opts.size = num(flag, v)
        break
      case 'png':
      case 'gif':
        flags[flag] = num(flag, v, { min: 1, whole: true })
        break
      case 'fps':
        flags.fps = num(flag, v, { min: FRAME_LIMITS.minFps })
        break
      case 'seconds':
        flags.seconds = num(flag, v)
        break
      case 'color':
        opts.color = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v)
          ? v
          : oneOf(flag, v, LISTS.color)
        break
      default:
        opts[flag] = oneOf(flag, v, LISTS[flag])
    }
  }
  if (flags.dress) opts.dress = true
  return { positionals, opts, flags, literal: rest }
}

/** The SVGs of `names` as one grid; each cell gets its own id prefix, so repeated names keep distinct ids. */
function grid(names, opts) {
  const cell = opts.size ?? 96
  const gap = Math.round(cell / 8)
  const cols = Math.ceil(Math.sqrt(names.length))
  const rows = Math.ceil(names.length / cols)
  const w = cols * cell + (cols - 1) * gap
  const h = rows * cell + (rows - 1) * gap
  const cells = names.map((name, i) => {
    const x = (i % cols) * (cell + gap)
    const y = Math.floor(i / cols) * (cell + gap)
    return toSvg(name, { ...opts, size: cell, id: `s${i}` }).replace(
      '<svg ',
      `<svg x="${x}" y="${y}" `,
    )
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${cells.join('')}</svg>\n`
}

/** The export package: the caller's, or an import by specifier. */
async function exporter(loadExport) {
  try {
    if (loadExport) return await loadExport()
    // INTERNAL test seam: overrides the module specifier (an absolute path
    // works too). The tests point it at a name that does not exist to prove
    // the install hint. Not public API.
    const spec =
      process.env.AWFLOW_AVATAR_EXPORT_MODULE || '@awflow/avatar-export'
    return await import(spec.startsWith('/') ? pathToFileURL(spec).href : spec)
  } catch {
    return fail(HINT)
  }
}

/**
 * Run the CLI. `io` is { out(bytes|string), err(string), stdin(): string,
 * loadExport?: () => Promise<module> }. Resolves to the exit code.
 */
export async function main(argv, io) {
  try {
    const { positionals, opts, flags, literal } = parse(argv)
    if (flags.help) {
      io.out(USAGE)
      return 0
    }
    if (flags.version) {
      io.out(`${VERSION}\n`)
      return 0
    }
    const raster = [flags.png, flags.gif, flags.sprite].filter(Boolean).length
    if (raster > 1) fail('use one of --png, --gif and --sprite')
    const sheet = !literal && positionals[0] === 'sheet'
    let names
    if (sheet) {
      if (positionals.length !== 2) fail('usage: awflow-avatar sheet <file|->')
      let text
      try {
        text =
          positionals[1] === '-'
            ? io.stdin()
            : readFileSync(positionals[1], 'utf8')
      } catch (e) {
        fail(`cannot read ${positionals[1]}: ${e?.code ?? e?.message ?? e}`)
      }
      names = text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (names.length < 1 || names.length > MAX_SHEET)
        fail(`a sheet takes 1 to ${MAX_SHEET} names, got ${names.length}`)
    } else {
      if (positionals.length !== 1)
        fail('usage: awflow-avatar <name> [options], try --help')
      names = [positionals[0]]
    }

    if (!raster) {
      io.out(sheet ? grid(names, opts) : `${toSvg(names[0], opts)}\n`)
      return 0
    }
    if (sheet && !flags.sprite) fail('sheet takes --sprite, not --png or --gif')
    const x = await exporter(io.loadExport)
    try {
      let bytes
      if (flags.sprite) {
        bytes = await x.toSprite(names, opts, { size: opts.size || 256 })
      } else if (flags.png) {
        bytes = await x.toPng(names[0], opts, { size: flags.png })
      } else {
        bytes = await x.toGif(names[0], opts, {
          size: flags.gif,
          fps: flags.fps,
          seconds: flags.seconds,
        })
      }
      io.out(bytes)
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e))
    }
    return 0
  } catch (e) {
    if (!(e instanceof Usage)) throw e
    io.err(`awflow-avatar: ${e.message}\n`)
    return 1
  }
}

/** main() wired to the process: raw bytes to stdout, one line to stderr. */
export async function run(argv, loadExport) {
  const chunks = []
  const code = await main(argv, {
    out: (d) =>
      chunks.push(typeof d === 'string' ? Buffer.from(d) : Buffer.from(d)),
    err: (s) => process.stderr.write(s),
    stdin: () => readFileSync(0, 'utf8'),
    loadExport,
  })
  const all = Buffer.concat(chunks)
  // exitCode, not exit(): a piped stdout must drain first
  let failure
  if (all.length)
    await new Promise((resolve) => {
      const done = (e) => {
        failure = failure ?? e
        resolve()
      }
      process.stdout.on('error', done)
      process.stdout.write(all, (e) => (e ? done(e) : resolve()))
    })
  // a reader that went away (| head) is not a failure
  if (failure && failure.code !== 'EPIPE') {
    process.stderr.write(
      `awflow-avatar: cannot write output: ${failure.code ?? failure.message}\n`,
    )
    process.exitCode = 1
    return
  }
  process.exitCode = failure ? 0 : code
}
