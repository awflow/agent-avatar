/*
 * Release preparation, never publishing. Run `bun scripts/release.ts`.
 *
 * For each publishable package, in dependency order: build it, copy it to a
 * staging directory outside the repo, rewrite the staged package.json into
 * its published form, pack it into .release/, then extract the tarball and
 * check what a consumer would get. Any violation exits 1. The committed
 * package.json files are never touched.
 *
 * The published manifest:
 * - `workspace:` specifiers resolve to `^<version>` (npm leaves them as they
 *   are, `bun pm pack` rewrites them but keeps everything below, so the
 *   rewrite is done here, explicitly, on the staged copy)
 * - no private `awflow-src` export condition anywhere
 * - no devDependencies and no scripts (prepack would rebuild from sources
 *   that do not ship)
 * - `sideEffects` present; every export, bin and types target in the tarball
 * - React's entry starts with 'use client'
 *
 * It prints the `npm publish` commands at the end. It never runs them.
 */
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const OUT = join(ROOT, '.release')

/** Dependency order: the core first, then whatever depends on it. */
const ORDER = [
  'avatar',
  'avatar-export',
  'avatar-svelte',
  'avatar-react',
  'avatar-vue',
  'avatar-solid',
  'avatar-element',
] as const
type Pkg = (typeof ORDER)[number]

/** Top-level paths a tarball may hold beyond package.json, README, LICENSE. */
const EXTRA: Partial<Record<Pkg, string[]>> = {
  avatar: ['bin'],
  'avatar-export': ['bin'],
  'avatar-svelte': ['src'],
}
const LIFECYCLE = [
  'preinstall',
  'install',
  'postinstall',
  'prepare',
  'prepack',
  'postpack',
  'prepublish',
  'prepublishOnly',
]
const DEP_FIELDS = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
] as const

type Json = Record<string, any>
const readJson = (path: string): Json => JSON.parse(readFileSync(path, 'utf8'))
const dirOf = (p: Pkg) => join(ROOT, 'packages', p)

const errors: string[] = []
const fail = (pkg: string, msg: string) => errors.push(`${pkg}: ${msg}`)

function run(cmd: string, args: string[], cwd: string): string {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' })
  if (r.status !== 0) {
    process.stderr.write(r.stdout ?? '')
    process.stderr.write(r.stderr ?? '')
    console.error(`release: ${cmd} ${args.join(' ')} failed in ${cwd}`)
    process.exit(1)
  }
  return r.stdout
}

// every package's name and version, for resolving `workspace:`
const manifests = new Map<string, Json>()
for (const dir of readdirSync(join(ROOT, 'packages'))) {
  const path = join(ROOT, 'packages', dir, 'package.json')
  if (existsSync(path)) {
    const m = readJson(path)
    manifests.set(m.name, m)
  }
}
const version = readJson(join(dirOf('avatar'), 'package.json'))
  .version as string
for (const p of ORDER) {
  const m = readJson(join(dirOf(p), 'package.json'))
  if (m.version !== version)
    fail(m.name, `version ${m.version}, expected ${version} like the core`)
  if (m.private) fail(m.name, 'is private')
}

/** `workspace:^` and friends to the range a registry install understands. */
function resolveWorkspace(name: string, spec: string, owner: string): string {
  const rest = spec.slice('workspace:'.length)
  const target = manifests.get(name)
  if (!target) {
    fail(owner, `${name}@${spec} names no workspace package`)
    return spec
  }
  if (rest === '' || rest === '*' || rest === '^') return `^${target.version}`
  if (rest === '~') return `~${target.version}`
  return rest
}

/** Drops the private source condition from an exports map, at any depth. */
function stripCondition(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripCondition)
  if (v && typeof v === 'object') {
    const out: Json = {}
    for (const [k, x] of Object.entries(v))
      if (k !== 'awflow-src') out[k] = stripCondition(x)
    return out
  }
  return v
}

function publishedManifest(m: Json): Json {
  const out: Json = structuredClone(m)
  for (const field of DEP_FIELDS) {
    const deps = out[field] as Record<string, string> | undefined
    if (!deps) continue
    for (const [name, spec] of Object.entries(deps))
      if (spec.startsWith('workspace:'))
        deps[name] = resolveWorkspace(name, spec, m.name)
  }
  delete out.devDependencies
  delete out.scripts
  if (out.exports) out.exports = stripCondition(out.exports)
  return out
}

/** Every string leaf of an exports map. */
function targets(v: unknown, into: string[] = []): string[] {
  if (typeof v === 'string') into.push(v)
  else if (Array.isArray(v)) for (const x of v) targets(x, into)
  else if (v && typeof v === 'object')
    for (const x of Object.values(v)) targets(x, into)
  return into
}

function listFiles(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    return e.isDirectory() ? listFiles(path, base) : [relative(base, path)]
  })
}

function check(p: Pkg, tarball: string): string[] {
  const name = `@awflow/${p}`
  const box = mkdtempSync(join(tmpdir(), 'awflow-release-check-'))
  try {
    run('tar', ['xzf', tarball, '-C', box], ROOT)
    const pkg = join(box, 'package')
    const files = listFiles(pkg).sort()
    const m = readJson(join(pkg, 'package.json'))
    const text = readFileSync(join(pkg, 'package.json'), 'utf8')

    if (m.name !== name) fail(name, `packed name is ${m.name}`)
    if (m.version !== version) fail(name, `packed version is ${m.version}`)
    if (text.includes('workspace:')) fail(name, 'a workspace: specifier ships')
    if (text.includes('awflow-src'))
      fail(name, 'the awflow-src condition ships')
    if (!('sideEffects' in m)) fail(name, 'no sideEffects field')
    if (m.devDependencies) fail(name, 'devDependencies ship')
    for (const s of LIFECYCLE)
      if (m.scripts?.[s]) fail(name, `a ${s} script ships`)
    if (m.license !== 'MIT') fail(name, `license is ${m.license}`)
    if (m.publishConfig?.access !== 'public')
      fail(name, 'publishConfig.access is not public')
    if (!m.repository?.url || !m.homepage)
      fail(name, 'repository or homepage missing')
    for (const field of DEP_FIELDS)
      for (const [dep, spec] of Object.entries(
        (m[field] ?? {}) as Record<string, string>,
      ))
        if (dep.startsWith('@awflow/') && spec !== `^${version}`)
          fail(name, `${field} ${dep}@${spec}, expected ^${version}`)

    // the file list: package.json, README, LICENSE, dist and the extras
    const allowed = ['dist', ...(EXTRA[p] ?? [])]
    for (const f of files) {
      const top = f.split('/')[0]!
      const ok =
        f === 'package.json' ||
        f === 'README.md' ||
        f === 'LICENSE' ||
        (f.includes('/') && allowed.includes(top))
      if (!ok) fail(name, `unexpected file ${f}`)
      if (/\.(test|spec)\.|__snapshots__|(^|\/)test\//.test(f))
        fail(name, `a test file ships: ${f}`)
    }
    for (const must of ['package.json', 'README.md', 'LICENSE'])
      if (!files.includes(must)) fail(name, `${must} missing`)
    if (!files.some((f) => f.startsWith('dist/'))) fail(name, 'dist missing')
    for (const extra of EXTRA[p] ?? [])
      if (!files.some((f) => f.startsWith(`${extra}/`)))
        fail(name, `${extra}/ missing`)

    const license = readFileSync(join(pkg, 'LICENSE'), 'utf8')
    for (const line of [
      'Copyright (c) 2026 Doan Labs',
      'Copyright (c) 2026 AWFlow',
    ])
      if (!license.includes(line)) fail(name, `LICENSE lacks "${line}"`)
    const readme = readFileSync(join(pkg, 'README.md'), 'utf8')
    if (!/Built on \[?Peek\]?(\([^)]*\))? by Doan Labs/.test(readme))
      fail(name, 'README lacks the "Built on Peek by Doan Labs" credit')
    if (!readme.includes(`npm install ${name}`))
      fail(name, 'README lacks the install line')

    // every path the manifest points at is in the tarball
    const pointed = [
      ...targets(m.exports),
      ...Object.values((m.bin ?? {}) as Record<string, string>),
      ...[m.types, m.svelte, m.main, m.module].filter(
        (x): x is string => typeof x === 'string',
      ),
    ]
    for (const t of pointed) {
      const rel = t.replace(/^\.\//, '')
      if (!files.includes(rel)) fail(name, `points at ${t}, not in the tarball`)
    }

    if (p === 'avatar-react') {
      const entry = readFileSync(join(pkg, 'dist/index.js'), 'utf8')
      if (!/^['"]use client['"]/.test(entry))
        fail(name, "dist/index.js does not start with 'use client'")
    }
    if (p === 'avatar-solid') {
      const solid = m.exports?.['.']?.solid
      if (solid !== './dist/source/index.js')
        fail(name, `solid condition is ${solid}`)
      if (!files.some((f) => f.endsWith('.jsx')))
        fail(name, 'no JSX-preserving source for the solid condition')
    }
    if (p === 'avatar') {
      if (m.dependencies && Object.keys(m.dependencies).length)
        fail(name, 'the core has runtime dependencies')
      if (!m.peerDependenciesMeta?.['@awflow/avatar-export']?.optional)
        fail(name, 'the avatar-export peer is not optional')
    }
    return files
  } finally {
    rmSync(box, { recursive: true, force: true })
  }
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const stage = mkdtempSync(join(tmpdir(), 'awflow-release-stage-'))
const packed: { name: string; file: string; files: string[] }[] = []

try {
  for (const p of ORDER) {
    const dir = dirOf(p)
    const m = readJson(join(dir, 'package.json'))
    console.log(`\n== ${m.name}@${m.version}`)
    run('bun', ['run', 'build'], dir)

    // the staged copy: the package without node_modules, its manifest
    // rewritten; npm pack then applies `files`
    const copy = join(stage, p)
    cpSync(dir, copy, {
      recursive: true,
      filter: (src) => !relative(dir, src).split('/').includes('node_modules'),
    })
    writeFileSync(
      join(copy, 'package.json'),
      `${JSON.stringify(publishedManifest(m), null, 2)}\n`,
    )
    const out = run(
      'npm',
      ['pack', '--ignore-scripts', '--json', '--pack-destination', OUT],
      copy,
    )
    const file = join(OUT, JSON.parse(out)[0].filename as string)
    const files = check(p, file)
    packed.push({ name: m.name, file, files })
    console.log(`${relative(ROOT, file)}: ${files.length} files`)
    for (const f of files) console.log(`  ${f}`)
  }
} finally {
  rmSync(stage, { recursive: true, force: true })
}

if (errors.length) {
  console.error(`\nrelease: ${errors.length} violation(s)`)
  for (const e of errors) console.error(`  ${e}`)
  process.exit(1)
}

console.log(
  `\nAll ${packed.length} tarballs pass the manifest and file checks.`,
)
console.log('Publish in this order (not run by this script):\n')
for (const { file } of packed)
  console.log(`npm publish ${relative(ROOT, file)} --access public`)
