/*
 * Export conditions, as a consumer resolves them. The workspace runs its
 * tests against src through a private `awflow-src` condition; nothing a
 * consumer sets (above all `development`, which every dev server turns on)
 * may reach src. Resolution runs in Node and in Bun, with the condition
 * given on the command line, from inside each package.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const packages = join(import.meta.dir, '..', '..')

/* every public entry of every package, as `<package dir>: [specifiers]` */
const ENTRIES: Record<string, string[]> = {
  avatar: ['', '/adapter', '/svg', '/compat', '/ai', '/identity'].map(
    (s) => `@awflow/avatar${s}`,
  ),
  'avatar-react': ['@awflow/avatar-react'],
  'avatar-vue': ['@awflow/avatar-vue'],
  'avatar-svelte': ['@awflow/avatar-svelte'],
  'avatar-solid': ['@awflow/avatar-solid'],
  'avatar-element': ['@awflow/avatar-element'],
}

function resolveWith(
  runtime: 'node' | 'bun',
  dir: string,
  condition: string,
  specifiers: string[],
): string[] {
  // Bun fails on a target that is not built yet: that prints `unbuilt`
  const code = `for (const s of ${JSON.stringify(specifiers)}) { try { console.log(import.meta.resolve(s)) } catch { console.log('unbuilt') } }`
  const cmd =
    runtime === 'node'
      ? ['node', `--conditions=${condition}`, '--input-type=module', '-e', code]
      : ['bun', `--conditions=${condition}`, '-e', code]
  const run = Bun.spawnSync(cmd, { cwd: join(packages, dir) })
  if (run.exitCode) throw new Error(run.stderr.toString())
  return run.stdout.toString().trim().split('\n')
}

describe('export conditions', () => {
  test('every exports entry starts with the private awflow-src condition', () => {
    for (const dir of Object.keys(ENTRIES)) {
      const pkg = JSON.parse(
        readFileSync(join(packages, dir, 'package.json'), 'utf8'),
      )
      for (const [path, target] of Object.entries(pkg.exports)) {
        const keys = Object.keys(target as object)
        expect(`${dir} ${path} ${keys[0]}`).toBe(`${dir} ${path} awflow-src`)
        expect(`${dir} ${path} ${keys.includes('development')}`).toBe(
          `${dir} ${path} false`,
        )
      }
    }
  })

  for (const runtime of ['node', 'bun'] as const)
    for (const [dir, specifiers] of Object.entries(ENTRIES)) {
      test(`${runtime}: development resolves ${dir} to dist`, () => {
        for (const url of resolveWith(
          runtime,
          dir,
          'development',
          specifiers,
        )) {
          expect(url).not.toContain('/src/')
          if (url !== 'unbuilt') expect(url).toContain(`/packages/${dir}/dist/`)
        }
      })

      test(`${runtime}: awflow-src resolves ${dir} to src`, () => {
        for (const url of resolveWith(runtime, dir, 'awflow-src', specifiers))
          expect(url).toContain(`/packages/${dir}/src/`)
      })
    }
})

describe('manifests', () => {
  test('every package but the element is free of side effects', () => {
    for (const dir of Object.keys(ENTRIES)) {
      const pkg = JSON.parse(
        readFileSync(join(packages, dir, 'package.json'), 'utf8'),
      )
      // the element registers its tags on import: it lists its own files
      const expected =
        dir === 'avatar-element' ? ['./dist/index.js', './src/index.ts'] : false
      expect(`${dir} ${JSON.stringify(pkg.sideEffects)}`).toBe(
        `${dir} ${JSON.stringify(expected)}`,
      )
    }
  })
})
