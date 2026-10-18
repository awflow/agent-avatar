/*
 * Bun 1.3's bundler drops every module's code when the package declares
 * `"sideEffects": false` and an entry only re-exports (dist/index.js came
 * out as a bare `export { ... }` naming nothing). A `sideEffects` list that
 * names only dist files does the same to src: the element's dist/index.js
 * shipped in 1.0.0 calling and exporting a `defineAvatarElements` it never
 * defined. The packages keep the field for their consumers' bundlers; the
 * build bundles a copy of src staged outside any package, where no
 * package.json applies, and checks that every entry still carries code and
 * defines every name it exports.
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

/** The local names an `export { a, b as c }` list exports. */
function exportedLocals(text: string): string[] {
  const names: string[] = []
  for (const [, list] of text.matchAll(/export\s*\{([^}]*)\}(?!\s*from)/g))
    for (const part of list!.split(','))
      if (part.trim()) names.push(part.trim().split(/\s+as\s+/)[0]!)
  return names
}

/** Whether `name` is declared or imported anywhere in the module. */
function binds(text: string, name: string): boolean {
  const n = name.replace(/\$/g, '\\$')
  return (
    new RegExp(`\\b(?:function\\*?|class|var|let|const)\\s+${n}\\b`).test(
      text,
    ) ||
    new RegExp(`\\b(?:var|let|const)\\s+[^;]*?[{,]\\s*${n}\\s*[,}=]`).test(
      text,
    ) ||
    new RegExp(`import\\s+${n}\\b`).test(text) ||
    new RegExp(`import\\s*\\*\\s*as\\s+${n}\\b`).test(text) ||
    new RegExp(
      `import\\s*(?:[\\w$]+\\s*,\\s*)?\\{[^}]*\\b(?:[\\w$]+\\s+as\\s+)?${n}\\s*[,}]`,
    ).test(text)
  )
}

/**
 * Fails the build when an output entry holds nothing but an export list, or
 * exports a name it never declares or imports (the shape of a module whose
 * definitions were tree-shaken away).
 */
export async function assertCode(files: string[]): Promise<void> {
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    for (const name of exportedLocals(text))
      if (!binds(text, name)) {
        console.error(`${file} exports ${name} but never defines it`)
        process.exit(1)
      }
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
