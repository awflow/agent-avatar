/*
 * Compile the component and its declarations for ordinary JS consumers.
 * React and @awflow/avatar stay external: one copy of each, the app's.
 */
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const outdir = 'dist'
await rm(outdir, { recursive: true, force: true })

const result = await Bun.build({
  entrypoints: ['src/index.ts'],
  root: 'src',
  outdir,
  target: 'browser',
  format: 'esm',
  packages: 'external',
  // a client module for React Server Components frameworks
  banner: "'use client';",
  define: { 'process.env.NODE_ENV': 'process.env.NODE_ENV' },
})
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

const entry = await Bun.file(`${outdir}/index.js`).text()
if (!/^['"]use client['"]/.test(entry)) {
  console.error(`${outdir}/index.js does not start with 'use client'`)
  process.exit(1)
}

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
