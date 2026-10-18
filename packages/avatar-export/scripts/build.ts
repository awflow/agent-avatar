/*
 * Compile the export entry and its declarations for ordinary JS consumers.
 * Every dependency stays external: @awflow/avatar is the app's one copy, and
 * the resvg wasm is read from @resvg/resvg-wasm where it is installed.
 */
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { assertCode, staged } from '../../avatar/scripts/stage'

const outdir = 'dist'
await rm(outdir, { recursive: true, force: true })

// bundled from a staged copy: see packages/avatar/scripts/stage.ts
const out = resolve(outdir)
const result = await staged(() =>
  Bun.build({
    entrypoints: ['src/index.ts'],
    root: 'src',
    outdir: out,
    target: 'browser',
    format: 'esm',
    packages: 'external',
    define: { 'process.env.NODE_ENV': 'process.env.NODE_ENV' },
  }),
)
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
await assertCode([`${outdir}/index.js`])

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

console.log(`built ${result.outputs.length} files into ${outdir}`)
