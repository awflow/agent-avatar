/*
 * Bun 1.3's bundler drops every module's code when the package declares
 * `"sideEffects": false` and an entry only re-exports (dist/index.js came
 * out as a bare `export { ... }` naming nothing). The packages keep the
 * flag for their consumers' bundlers; the build bundles a copy of src
 * staged outside any package, where no package.json applies, and checks
 * that every entry still carries code.
 */
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Runs `build` inside a temporary copy of `src` (as `<tmp>/src`, with the
 * temporary directory as the working directory, so the `// src/...` path
 * comments in the output are the same as from the package), then removes
 * the copy. Pass the output directory to `build` as an absolute path.
 */
export async function staged<T>(build: () => Promise<T>): Promise<T> {
  const home = process.cwd()
  const dir = await mkdtemp(join(tmpdir(), 'awflow-avatar-build-'))
  await cp(join(home, 'src'), join(dir, 'src'), { recursive: true })
  process.chdir(dir)
  try {
    return await build()
  } finally {
    process.chdir(home)
    await rm(dir, { recursive: true, force: true })
  }
}

/** Fails the build when an output entry holds nothing but an export list. */
export async function assertCode(files: string[]): Promise<void> {
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    const code = text
      .replace(/^['"]use client['"];?/, '')
      .replace(/\/\/[^\n]*\n/g, '')
      .replace(/export\s*\{[^}]*\};?/g, '')
      .trim()
    if (!code) {
      console.error(`${file} came out empty: it only re-exports nothing`)
      process.exit(1)
    }
  }
}
