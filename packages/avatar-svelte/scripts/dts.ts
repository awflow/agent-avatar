/*
 * Runs after svelte-package. Under moduleResolution nodenext TypeScript does
 * not find `avatar.svelte.d.ts` for `from './avatar.svelte'`; it does for
 * `./avatar.svelte.js`, as bundler resolution does. So the declarations (and
 * only they: the runtime imports stay as the Svelte compiler expects) name
 * components as `.svelte.js` and other relative modules with `.js`.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const outdir = 'dist'
for (const file of await readdir(outdir, { recursive: true })) {
  if (!file.endsWith('.d.ts')) continue
  const path = resolve(outdir, file)
  const source = await readFile(path, 'utf8')
  await writeFile(
    path,
    source.replace(
      /(from\s+['"]|import\(['"])(\.\.?\/[^'"]+?)(['"])/g,
      (all, a: string, spec: string, b: string) =>
        /\.(js|mjs|cjs|json)$/.test(spec) ? all : `${a}${spec}.js${b}`,
    ),
  )
}
