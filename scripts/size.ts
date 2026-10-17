/*
 * The core's size on the wire: packages/avatar/dist/index.js and every chunk
 * it imports, followed statically, concatenated and gzipped at level 9.
 * Written to apps/web/src/generated/size.json for the site's footer line.
 * Run after `bun run build`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const ROOT = resolve(import.meta.dir, '..')
const ENTRY = join(ROOT, 'packages/avatar/dist/index.js')
const OUT = join(ROOT, 'apps/web/src/generated/size.json')

if (!existsSync(ENTRY)) {
  console.error('size: packages/avatar/dist/index.js is missing, build first')
  process.exit(1)
}

// static imports and re-exports only: `from './x.js'` and `import './x.js'`
const IMPORT = /(?:\bfrom\s*|\bimport\s*)["'](\.{1,2}\/[^"']+)["']/g

const seen = new Set<string>()
function walk(file: string) {
  if (seen.has(file)) return
  seen.add(file)
  const code = readFileSync(file, 'utf8')
  for (const [, spec] of code.matchAll(IMPORT))
    walk(resolve(dirname(file), spec!))
}
walk(ENTRY)

const files = [...seen].sort()
const raw = Buffer.concat(files.map((f) => readFileSync(f)))
const gzip = gzipSync(raw, { level: 9 }).length
const size = {
  entry: 'packages/avatar/dist/index.js',
  files: files.map((f) => relative(ROOT, f)),
  bytes: raw.length,
  gzip,
  kb: Math.round((gzip / 1024) * 10) / 10,
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, `${JSON.stringify(size, null, 2)}\n`)
console.log(
  `size: ${size.kb} KB gzipped (${gzip} B, ${raw.length} B raw, ${files.length} files) -> ${relative(ROOT, OUT)}`,
)
