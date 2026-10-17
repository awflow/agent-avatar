/*
 * Every docs code block tagged `check` must compile against the workspace
 * packages. The blocks are written to apps/web/.snippets as modules (a
 * Svelte block contributes its <script> body) and typechecked with tsc.
 * Fails when a block does not compile, and when there is nothing to check.
 *
 * Run from anywhere: `bun apps/web/scripts/check-snippets.ts`. The packages'
 * `dist` declarations must exist, so build first.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PAGES } from '../src/lib/docs'

const WEB = resolve(import.meta.dir, '..')
const OUT = join(WEB, '.snippets')

type Snippet = { file: string; where: string; source: string }

const found: Snippet[] = []
for (const page of PAGES)
  page.blocks.forEach((b, i) => {
    if (typeof b !== 'object' || !('code' in b) || !b.check) return
    const where = `/docs${page.slug ? `/${page.slug}` : ''} block ${i}`
    const base = `${page.slug || 'index'}-${i}`
    let body = b.code
    let ext: 'ts' | 'tsx'
    if (b.lang === 'svelte') {
      const script = /<script[^>]*>([\s\S]*?)<\/script>/.exec(b.code)
      if (!script) throw new Error(`${where}: a svelte block without <script>`)
      body = script[1]!
      ext = 'ts'
    } else if (b.lang === 'ts' || b.lang === 'tsx') ext = b.lang
    else
      throw new Error(`${where}: only ts, tsx and svelte blocks can be checked`)
    // a module of its own, so top-level await and names never clash
    const source = `${b.prelude ? `${b.prelude}\n` : ''}${body}\nexport {}\n`
    found.push({ file: `${base}.${ext}`, where, source })
  })

if (!found.length) {
  console.error('check-snippets: no `check` blocks in apps/web/src/lib/docs.ts')
  process.exit(1)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
for (const s of found) writeFileSync(join(OUT, s.file), s.source)

// Svelte components import as their default export; the adapter's own
// declarations cover the package itself
writeFileSync(
  join(OUT, 'env.d.ts'),
  `declare module '*.svelte' {
  import type { Component } from 'svelte'
  const c: Component<Record<string, unknown>>
  export default c
}
`,
)
writeFileSync(
  join(OUT, 'tsconfig.json'),
  JSON.stringify(
    {
      extends: '@awflow/typescript-config/react.json',
      include: ['./*.ts', './*.tsx'],
      compilerOptions: {
        noUnusedLocals: false,
        noUnusedParameters: false,
        types: ['node'],
      },
    },
    null,
    2,
  ),
)

const tsc = spawnSync(
  'bun',
  ['x', 'tsc', '--noEmit', '-p', join(OUT, 'tsconfig.json')],
  { cwd: WEB, encoding: 'utf8' },
)
const out = `${tsc.stdout}${tsc.stderr}`.trim()
if (tsc.status !== 0) {
  // name the docs block behind each failing file
  const named = out.replace(/\.snippets\/([\w-]+\.tsx?)/g, (m, f: string) => {
    const s = found.find((x) => x.file === f)
    return s ? `${m} (${s.where})` : m
  })
  console.error(named || `tsc exited ${tsc.status}`)
  console.error(`check-snippets: FAIL (${found.length} blocks)`)
  process.exit(1)
}
console.log(`check-snippets: ${found.length} blocks typecheck`)
