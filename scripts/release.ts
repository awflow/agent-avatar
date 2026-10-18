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
 * Packages version independently (a patch may bump only some of them). Each
 * `workspace:` dependency resolves to that dependency's own version.
 *
 * After the file checks, the tarballs are installed into one temporary
 * consumer, which is typechecked (tsc, bundler and nodenext) and then run
 * under plain Node by scripts/smoke/runtime.mjs: every entry imported, every
 * declared value export present, every adapter's server render equal to
 * toSvg, the element rendering under happy-dom and both bins working.
 *
 * Each `name@version` is looked up on npm. One already published is packed
 * and checked like the rest (the consumer needs it), its tarball must be
 * identical to the published one (a change needs a new version), and its
 * publish command is printed as skipped.
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
for (const p of ORDER) {
  const m = readJson(join(dirOf(p), 'package.json'))
  if (!/^\d+\.\d+\.\d+$/.test(m.version))
    fail(m.name, `version ${m.version} is not x.y.z`)
  if (m.private) fail(m.name, 'is private')
}
const versionOf = (name: string): string => manifests.get(name)?.version

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
    const version = versionOf(name)
    if (m.version !== version)
      fail(name, `packed version is ${m.version}, the manifest's ${version}`)
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
        if (dep.startsWith('@awflow/') && spec !== `^${versionOf(dep)}`)
          fail(name, `${field} ${dep}@${spec}, expected ^${versionOf(dep)}`)

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

/**
 * Whether `name@version` is on npm. Found or E404 are answers; anything
 * else (no network, a registry error) stops the script, since an unknown
 * answer could print a publish command for a version that already exists.
 */
function onNpm(name: string, version: string): boolean {
  const r = spawnSync(
    'npm',
    ['view', `${name}@${version}`, 'version', '--json'],
    { encoding: 'utf8' },
  )
  if (r.status === 0) return r.stdout.trim() !== ''
  if (`${r.stdout}${r.stderr}`.includes('E404')) return false
  process.stderr.write(r.stderr ?? '')
  console.error(`release: cannot ask npm about ${name}@${version}`)
  process.exit(1)
}

/** Extracts a tarball into a fresh directory and returns its package/. */
function extract(tarball: string): string {
  const box = mkdtempSync(join(tmpdir(), 'awflow-release-x-'))
  run('tar', ['xzf', tarball, '-C', box], ROOT)
  return join(box, 'package')
}

/**
 * An already published version must not change: the packed tarball must be
 * the published one, file for file and byte for byte. The one allowance is
 * an `@awflow/*` dependency range, which follows the dependency's current
 * version in the repo: the published range must still accept it.
 */
function samePublished(name: string, version: string, tarball: string) {
  const dl = mkdtempSync(join(tmpdir(), 'awflow-release-npm-'))
  const dirs: string[] = []
  try {
    const out = run(
      'npm',
      ['pack', `${name}@${version}`, '--json', '--pack-destination', dl],
      dl,
    )
    const theirs = extract(join(dl, JSON.parse(out)[0].filename as string))
    const ours = extract(tarball)
    dirs.push(theirs, ours)
    const a = listFiles(theirs).sort()
    const b = listFiles(ours).sort()
    for (const f of a)
      if (!b.includes(f)) fail(name, `${f} is published, no longer packed`)
    for (const f of b)
      if (!a.includes(f)) fail(name, `${f} is packed, not in the published`)
    for (const f of b.filter((x) => a.includes(x) && x !== 'package.json'))
      if (!readFileSync(join(theirs, f)).equals(readFileSync(join(ours, f))))
        fail(name, `${f} differs from the published ${version}`)
    const pub = readJson(join(theirs, 'package.json'))
    const mine = readJson(join(ours, 'package.json'))
    for (const field of DEP_FIELDS)
      for (const [dep, spec] of Object.entries(
        (pub[field] ?? {}) as Record<string, string>,
      )) {
        if (!dep.startsWith('@awflow/') || !mine[field]?.[dep]) continue
        if (!Bun.semver.satisfies(versionOf(dep), spec))
          fail(name, `published ${dep}@${spec} rejects ${versionOf(dep)}`)
        mine[field][dep] = spec
      }
    if (JSON.stringify(pub) !== JSON.stringify(mine))
      fail(name, `package.json differs from the published ${version}`)
  } finally {
    rmSync(dl, { recursive: true, force: true })
    for (const d of dirs)
      rmSync(join(d, '..'), { recursive: true, force: true })
  }
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const stage = mkdtempSync(join(tmpdir(), 'awflow-release-stage-'))
const packed: {
  name: string
  version: string
  file: string
  files: string[]
  published: boolean
}[] = []

try {
  for (const p of ORDER) {
    const dir = dirOf(p)
    const m = readJson(join(dir, 'package.json'))
    const published = onNpm(m.name, m.version)
    console.log(
      `\n== ${m.name}@${m.version}${published ? ' (already on npm)' : ''}`,
    )
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
    if (published) samePublished(m.name, m.version, file)
    packed.push({ name: m.name, version: m.version, file, files, published })
    console.log(`${relative(ROOT, file)}: ${files.length} files`)
    for (const f of files) console.log(`  ${f}`)
  }
} finally {
  rmSync(stage, { recursive: true, force: true })
}

/** Every public entry and subpath, as a consumer imports them. */
const ENTRIES = [
  '@awflow/avatar',
  '@awflow/avatar/adapter',
  '@awflow/avatar/svg',
  '@awflow/avatar/compat',
  '@awflow/avatar/ai',
  '@awflow/avatar/identity',
  '@awflow/avatar/cli',
  '@awflow/avatar-export',
  '@awflow/avatar-svelte',
  '@awflow/avatar-react',
  '@awflow/avatar-vue',
  '@awflow/avatar-solid',
  '@awflow/avatar-element',
]
/** The frameworks' own packages, for their types and the runtime smoke. */
const CONSUMER_DEPS: Record<string, string> = {
  react: '^19.2.0',
  'react-dom': '^19.2.0',
  '@types/react': '^19.2.0',
  vue: '^3.5.0',
  svelte: '^5.20.0',
  'solid-js': '^1.9.0',
  '@happy-dom/global-registrator': '^21.0.3',
  typescript: readJson(join(ROOT, 'node_modules/typescript/package.json'))
    .version,
}

/** A fresh consumer with every tarball installed, as an app would. */
function consumer(): string {
  const dir = mkdtempSync(join(tmpdir(), 'awflow-release-consumer-'))
  const tarballs = Object.fromEntries(
    packed.map(({ name, file }) => [name, `file:${file}`]),
  )
  writeFileSync(
    join(dir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'awflow-release-consumer',
        private: true,
        type: 'module',
        dependencies: tarballs,
        devDependencies: CONSUMER_DEPS,
        // the tarballs depend on each other by range: these, not npm's
        overrides: tarballs,
      },
      null,
      2,
    )}\n`,
  )
  run('bun', ['install', '--no-save'], dir)
  writeFileSync(
    join(dir, 'entries.ts'),
    `${ENTRIES.map((e, i) => `import * as m${i} from '${e}'`).join('\n')}\n` +
      `export const all = [${ENTRIES.map((_, i) => `m${i}`).join(', ')}]\n`,
  )
  return dir
}

/**
 * Typechecks an import of every public entry with library checking on
 * (skipLibCheck false), strict, under moduleResolution bundler and under
 * nodenext, so a shipped .d.ts that names an untyped module or an
 * extensionless relative path fails here.
 */
function consumerTypes(dir: string) {
  console.log('\n== consumer typecheck (bundler, nodenext)')
  const common = {
    strict: true,
    skipLibCheck: false,
    noEmit: true,
    target: 'ES2022',
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    types: [],
  }
  const modes = {
    bundler: { module: 'ESNext', moduleResolution: 'bundler' },
    nodenext: { module: 'NodeNext', moduleResolution: 'NodeNext' },
  }
  for (const [mode, o] of Object.entries(modes)) {
    const config = `tsconfig.${mode}.json`
    writeFileSync(
      join(dir, config),
      JSON.stringify({
        compilerOptions: { ...common, ...o },
        files: ['entries.ts'],
      }),
    )
    const r = spawnSync(
      join(dir, 'node_modules/.bin/tsc'),
      ['-p', config, '--pretty', 'false'],
      { cwd: dir, encoding: 'utf8' },
    )
    const lines = `${r.stdout}${r.stderr}`.split('\n').filter(Boolean)
    if (r.status !== 0) {
      for (const line of lines) fail(`tsc ${mode}`, line)
      if (!lines.length) fail(`tsc ${mode}`, `exit ${r.status}`)
    } else console.log(`tsc ${mode}: ${ENTRIES.length} entries, 0 errors`)
  }
}

/**
 * The value exports each entry's shipped declarations promise, read with
 * the TypeScript API from the consumer's entries.ts (nodenext). The runtime
 * smoke checks that every one of them exists.
 */
async function declaredExports(dir: string): Promise<Record<string, string[]>> {
  const ts = (
    await import(join(dir, 'node_modules/typescript/lib/typescript.js'))
  ).default as typeof import('typescript')
  const program = ts.createProgram([join(dir, 'entries.ts')], {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
    types: [],
  })
  const checker = program.getTypeChecker()
  const source = program.getSourceFile(join(dir, 'entries.ts'))!
  const out: Record<string, string[]> = {}
  for (const st of source.statements) {
    if (!ts.isImportDeclaration(st)) continue
    const entry = (st.moduleSpecifier as import('typescript').StringLiteral)
      .text
    const mod = checker.getSymbolAtLocation(st.moduleSpecifier)
    if (!mod) {
      fail(entry, 'declarations do not resolve')
      continue
    }
    out[entry] = checker
      .getExportsOfModule(mod)
      .filter((s) => {
        const t =
          s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s
        return t.flags & ts.SymbolFlags.Value
      })
      .map((s) => s.name)
      .sort()
    if (!out[entry]!.length) fail(entry, 'declares no value export')
  }
  return out
}

/** scripts/smoke/runtime.mjs inside the consumer, under plain Node. */
async function runtimeSmoke(dir: string) {
  console.log('\n== runtime smoke (plain node, from the tarballs)')
  writeFileSync(
    join(dir, 'exports.json'),
    `${JSON.stringify(await declaredExports(dir), null, 2)}\n`,
  )
  for (const f of ['runtime.mjs', 'svelte-hooks.mjs'])
    cpSync(join(ROOT, 'scripts/smoke', f), join(dir, f))
  const r = spawnSync('node', ['runtime.mjs'], { cwd: dir, encoding: 'utf8' })
  process.stdout.write(r.stdout ?? '')
  if (r.status !== 0) {
    const lines = `${r.stderr}`.split('\n').filter(Boolean)
    for (const line of lines) fail('runtime smoke', line)
    if (!lines.length) fail('runtime smoke', `exit ${r.status}`)
  }
}

if (!errors.length) {
  const dir = consumer()
  try {
    consumerTypes(dir)
    await runtimeSmoke(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (errors.length) {
  console.error(`\nrelease: ${errors.length} violation(s)`)
  for (const e of errors) console.error(`  ${e}`)
  process.exit(1)
}

console.log(
  `\nAll ${packed.length} tarballs pass the manifest, file, type and runtime checks.`,
)
console.log('Publish in this order (not run by this script):\n')
for (const { name, version, file, published } of packed)
  console.log(
    published
      ? `# skip ${name}@${version}: already on npm`
      : `npm publish ${relative(ROOT, file)} --access public`,
  )
