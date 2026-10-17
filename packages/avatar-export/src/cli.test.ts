import { beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { PNG_SIGNATURE, readGif, readPng } from './test/decode'

const root = join(import.meta.dir, '..')
const exportBin = join(root, 'bin', 'awflow-avatar-export.mjs')
const coreBin = join(root, '..', 'avatar', 'bin', 'awflow-avatar.mjs')

beforeAll(async () => {
  if (existsSync(join(root, 'dist', 'index.js'))) return
  const build = Bun.spawn(['bun', 'scripts/build.ts'], { cwd: root })
  if (await build.exited) throw new Error('export build failed')
})

async function node(bin: string, args: string[], env: object = {}) {
  const p = Bun.spawn(['node', bin, ...args], {
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ...env },
  })
  const [out, err, code] = await Promise.all([
    new Response(p.stdout).arrayBuffer(),
    new Response(p.stderr).text(),
    p.exited,
  ])
  return { out: new Uint8Array(out), err, code }
}

const head = (b: Uint8Array) => [...b.slice(0, 8)]

describe('awflow-avatar-export bin', () => {
  test('--png writes raw PNG bytes', async () => {
    const r = await node(exportBin, ['Linh', '--png', '64'])
    expect(r.code).toBe(0)
    expect(head(r.out)).toEqual([...PNG_SIGNATURE])
    const img = readPng(r.out)
    expect(img.width).toBe(64)
  })

  test('--gif writes a GIF', async () => {
    const r = await node(exportBin, [
      'Linh',
      '--gif',
      '32',
      '--fps',
      '4',
      '--seconds',
      '1',
    ])
    expect(r.code).toBe(0)
    expect(new TextDecoder().decode(r.out.slice(0, 3))).toBe('GIF')
    expect(readGif(r.out).frames).toBe(4)
  })

  test('--sprite writes a sheet and an over-limit size is one line', async () => {
    const ok = await node(exportBin, ['Linh', '--sprite', '--size', '16'])
    expect(ok.code).toBe(0)
    expect(head(ok.out)).toEqual([...PNG_SIGNATURE])
    const bad = await node(exportBin, ['Linh', '--png', '99999'])
    expect(bad.code).toBe(1)
    expect(bad.err.trim().split('\n').length).toBe(1)
  })
})

describe('awflow-avatar with the export module', () => {
  test('--png resolves the module through the test seam', async () => {
    const r = await node(coreBin, ['Linh', '--png', '48'], {
      AWFLOW_AVATAR_EXPORT_MODULE: join(root, 'dist', 'index.js'),
    })
    expect(r.code).toBe(0)
    expect(head(r.out)).toEqual([...PNG_SIGNATURE])
  })
})
