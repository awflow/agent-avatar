/*
 * The published build, end to end: every entry point is built into one
 * temporary outdir (inside the package, so `react` still resolves), then a
 * plugin registered through the main entry must be visible through the
 * adapter and ai entries. One registry across entries is the contract.
 */
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { resetPluginsForTests, plugins as sourcePlugins } from '../src/plugins'

const root = join(import.meta.dir, '..')
const out = join(root, `.smoke-dist-${process.pid}`)

beforeAll(async () => {
  const build = Bun.spawn(['bun', 'scripts/build.ts', '--outdir', out], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const code = await build.exited
  if (code) throw new Error(await new Response(build.stderr).text())
}, 120_000)

afterAll(async () => {
  resetPluginsForTests()
  await rm(out, { recursive: true, force: true })
})

test('the entries share one registry implementation', async () => {
  const files = (await readdir(out, { recursive: true })).filter(
    (f) => f.endsWith('.js') && !f.endsWith('.d.ts'),
  )
  const defining: string[] = []
  for (const f of files) {
    const src = await readFile(join(out, f), 'utf8')
    if (/function registerPlugins\(/.test(src)) defining.push(f)
  }
  expect(defining).toHaveLength(1)
  for (const entry of ['index', 'svg', 'identity', 'adapter', 'compat', 'ai']) {
    expect(existsSync(join(out, `${entry}.js`))).toBe(true)
    expect(existsSync(join(out, `${entry}.d.ts`))).toBe(true)
  }
  // declaration imports keep their .js extension, subfolders included
  const wear = await readFile(join(out, 'wardrobe/context.d.ts'), 'utf8')
  expect(wear).toMatch(/from '\.\.\/draw\.js'/)
})

test('a plugin registered through index reaches adapter and ai', async () => {
  const index = await import(join(out, 'index.js'))
  const adapter = await import(join(out, 'adapter.js'))
  const ai = await import(join(out, 'ai.js'))
  const hat = index.defineAccessory({
    slot: 'headwear',
    name: 'smoke-hat',
    draw: () => [
      {
        tag: 'circle',
        key: 'dot',
        attrs: { cx: '170', cy: '30', r: '7', fill: '#123456' },
        children: [],
      },
    ],
  })
  const theme = { ...index.THEMES.clay, name: 'smoke-theme' }
  index.registerPlugins([hat, { kind: 'theme', theme }])
  const svg = adapter.toSvg('Linh', {
    headwear: 'smoke-hat',
    theme: 'smoke-theme',
    size: 300,
  })
  expect(svg).toContain('fill="#123456"')
  expect(adapter.themeOf('smoke-theme').name).toBe('smoke-theme')
  expect(adapter.plugins()).toContain(hat)
  // a second copy of the package (here: the sources) shares the registry
  expect(sourcePlugins()).toContain(hat)
  const schema = ai.lookSchema()
  expect(schema.properties.headwear.enum).toContain('smoke-hat')
  expect(schema.properties.theme.enum).toContain('smoke-theme')
})
