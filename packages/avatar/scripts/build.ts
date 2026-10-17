/*
 * Compile public entry points and declarations for ordinary JS consumers.
 *
 * Every entry is built in ONE pass with code splitting, so the modules they
 * share (the plugin and theme registries above all) land in shared chunks
 * and exist once: a plugin registered through the main entry is the same
 * plugin the adapter and ai entries see.
 *
 * `--outdir <dir>` builds somewhere else than `dist` (the smoke test uses it).
 */
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { assertCode, staged } from './stage'

const at = process.argv.indexOf('--outdir')
const outdir = at > 0 && process.argv[at + 1] ? process.argv[at + 1]! : 'dist'

// stale chunks from an earlier build would ship otherwise
await rm(outdir, { recursive: true, force: true })

const ENTRIES = ['index', 'svg', 'identity', 'adapter', 'compat', 'ai']
// bundled from a staged copy: see stage.ts
const out = resolve(outdir)
const result = await staged(() =>
  Bun.build({
    entrypoints: ENTRIES.map((e) => `src/${e}.ts`),
    root: 'src',
    outdir: out,
    splitting: true,
    target: 'browser',
    format: 'esm',
    // Bun would inline its own NODE_ENV here and leave development warnings
    // on (or off) for good. Kept as a literal, the consumer's bundler or
    // runtime decides, as with any library.
    define: { 'process.env.NODE_ENV': 'process.env.NODE_ENV' },
    naming: {
      entry: '[dir]/[name].[ext]',
      chunk: 'chunks/[name]-[hash].[ext]',
    },
  }),
)
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
await assertCode(ENTRIES.map((e) => join(outdir, `${e}.js`)))

const declarations = Bun.spawn(
  ['bunx', 'tsc', '-p', 'tsconfig.build.json', '--outDir', outdir],
  { stdout: 'inherit', stderr: 'inherit' },
)
if (await declarations.exited) process.exit(1)

// Node's ESM resolver requires extensions in declaration imports too.
for (const file of await readdir(outdir, { recursive: true })) {
  if (!file.endsWith('.d.ts')) continue
  const path = resolve(outdir, file)
  const source = await readFile(path, 'utf8')
  await writeFile(
    path,
    source.replace(
      /(from\s+['"])(\.\.?\/[^'"]+?)(?<!\.js)(['"])/g,
      '$1$2.js$3',
    ),
  )
}

console.log(
  `built ${result.outputs.length} files into ${relative(process.cwd(), resolve(outdir)) || '.'}`,
)
