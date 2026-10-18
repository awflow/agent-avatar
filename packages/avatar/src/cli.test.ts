import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { toSvg } from './index'

const root = join(import.meta.dir, '..')
const bin = join(root, 'bin', 'awflow-avatar.mjs')

// the bin runs under plain Node against dist/
beforeAll(async () => {
  if (existsSync(join(root, 'dist', 'index.js'))) return
  const build = Bun.spawn(['bun', 'scripts/build.ts'], { cwd: root })
  if (await build.exited) throw new Error('core build failed')
})

async function cli(args: string[], stdin?: string, env: object = {}) {
  const p = Bun.spawn(['node', bin, ...args], {
    stdin: stdin === undefined ? 'ignore' : new Blob([stdin]),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ...env },
  })
  const [out, err, code] = await Promise.all([
    new Response(p.stdout).arrayBuffer(),
    new Response(p.stderr).text(),
    p.exited,
  ])
  return { out: Buffer.from(out), text: Buffer.from(out).toString(), err, code }
}

const oneLine = (err: string) => {
  expect(err.trim().split('\n').length).toBe(1)
  expect(err).not.toContain(' at ')
}

describe('awflow-avatar', () => {
  test('a name prints toSvg of it', async () => {
    const r = await cli(['Linh', '--theme', 'bold'])
    expect(r.code).toBe(0)
    expect(r.text.trimEnd()).toBe(toSvg('Linh', { theme: 'bold' }))
  })

  test('options, = form and axes reach toSvg', async () => {
    const r = await cli([
      'Linh',
      '--shape=blob',
      '--expression',
      'happy',
      '--framing',
      'full',
      '--size',
      '120',
      '--eyes',
      'dot',
      '--dress',
    ])
    expect(r.code).toBe(0)
    expect(r.text.trimEnd()).toBe(
      toSvg('Linh', {
        shape: 'blob',
        expression: 'happy',
        framing: 'full',
        size: 120,
        eyes: 'dot',
        dress: true,
      }),
    )
  })

  test('an empty name still draws', async () => {
    const r = await cli([''])
    expect(r.code).toBe(0)
    expect(r.text).toStartWith('<svg')
  })

  test('--size 0 is finite', async () => {
    const r = await cli(['Linh', '--size', '0'])
    expect(r.code).toBe(0)
    expect(r.text).toStartWith('<svg')
    expect(r.text).not.toMatch(/NaN|Infinity/)
  })

  test('--help and --version exit 0', async () => {
    const h = await cli(['--help'])
    expect(h.code).toBe(0)
    expect(h.text).toContain('Usage')
    const v = await cli(['--version'])
    expect(v.code).toBe(0)
    expect(v.text.trim()).toMatch(/^\d+\.\d+\.\d+/)
  })

  for (const args of [
    ['Linh', '--bogus'],
    ['Linh', '--theme', 'nope'],
    ['Linh', '--size', '-3'],
    ['Linh', '--size', 'abc'],
    ['Linh', '--theme'],
    ['Linh', '--eyes', 'nope'],
    ['Linh', '--png', '0'],
    [],
    ['a', 'b'],
  ])
    test(`invalid ${JSON.stringify(args)} is one stderr line`, async () => {
      const r = await cli(args)
      expect(r.code).toBe(1)
      expect(r.out.length).toBe(0)
      oneLine(r.err)
    })

  test('sheet draws one grid with distinct ids', async () => {
    const r = await cli(['sheet', '-', '--size', '64'], 'Linh\n\nBao\r\nAda\n')
    expect(r.code).toBe(0)
    expect(r.text.match(/<svg /g)?.length).toBe(4)
    const ids = r.text.match(/ id="[^"]+"/g)!
    expect(new Set(ids).size).toBe(ids.length)
    expect(r.text).toContain('x="')
  })

  test('sheet rejects an empty list and a missing file', async () => {
    expect((await cli(['sheet', '-'], '\n')).code).toBe(1)
    const r = await cli(['sheet', '/no/such/file'])
    expect(r.code).toBe(1)
    oneLine(r.err)
  })

  test('raster flags without the export package print the hint', async () => {
    for (const flag of [['--png', '128'], ['--gif', '64'], ['--sprite']]) {
      const r = await cli(['Linh', ...flag], undefined, {
        AWFLOW_AVATAR_EXPORT_MODULE: 'awflow-no-such-export-package',
      })
      expect(r.code).toBe(1)
      expect(r.err).toBe(
        'awflow-avatar: Install @awflow/avatar-export for --png/--gif/--sprite\n',
      )
    }
  })

  test('sheet keeps every cell and distinct ids for repeated names', async () => {
    const r = await cli(['sheet', '-'], 'Linh\nLinh\nLinh\n')
    expect(r.code).toBe(0)
    expect(r.text.match(/<svg /g)?.length).toBe(4)
    const ids = r.text.match(/ id="[^"]+"/g)!
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('after -- the word sheet is a name', async () => {
    const r = await cli(['--', 'sheet'])
    expect(r.code).toBe(0)
    expect(r.text).toContain('aria-label="sheet"')
    expect((await cli(['--help'])).text).toContain('After --')
  })

  test('a closed pipe is quiet', async () => {
    const p = Bun.spawn(
      [
        'sh',
        '-c',
        `node ${bin} sheet - --size 200 < ${join(root, 'package.json')} | true; exit \${'$'}{PIPESTATUS:-0}`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    const err = await new Response(p.stderr).text()
    await p.exited
    expect(err).not.toContain('EPIPE')
    expect(err).not.toContain('Error')
  })

  test('-h and -v are --help and --version', async () => {
    const h = await cli(['-h'])
    expect(h.code).toBe(0)
    expect(h.text).toBe((await cli(['--help'])).text)
    const v = await cli(['-v'])
    expect(v.code).toBe(0)
    expect(v.text).toBe((await cli(['--version'])).text)
    // after -- they are names
    expect((await cli(['--', '-h'])).text).toContain('aria-label="-h"')
  })

  for (const args of [
    ['Linh', '--png', '64', '--fps', '10'],
    ['Linh', '--png', '64', '--seconds', '1'],
    ['Linh', '--sprite', '--fps', '10'],
    ['Linh', '--sprite', '--seconds', '1'],
    ['Linh', '--fps', '10'],
  ])
    test(`${JSON.stringify(args)}: --fps/--seconds need --gif`, async () => {
      const r = await cli(args, undefined, {
        AWFLOW_AVATAR_EXPORT_MODULE: 'awflow-no-such-export-package',
      })
      expect(r.code).toBe(1)
      expect(r.out.length).toBe(0)
      expect(r.err).toBe(
        'awflow-avatar: --fps and --seconds apply to --gif only\n',
      )
    })

  describe('sheet input is bounded', () => {
    const limit =
      'awflow-avatar: a sheet input is limited to 65536 bytes (64 KiB)\n'
    const dir = mkdtempSync(join(tmpdir(), 'awflow-cli-'))
    const big = join(dir, 'big.txt')
    const ok = join(dir, 'ok.txt')
    beforeAll(() => {
      writeFileSync(big, 'Linh\n'.repeat(20_000))
      writeFileSync(ok, `${'x'.repeat(65_530)}\nLinh\n`.slice(0, 65_536))
    })
    afterAll(() => rmSync(dir, { recursive: true, force: true }))

    test('a file over 64 KiB is refused before it is read', async () => {
      const r = await cli(['sheet', big])
      expect(r.code).toBe(1)
      expect(r.out.length).toBe(0)
      expect(r.err).toBe(limit)
    })

    test('stdin over 64 KiB is refused', async () => {
      const r = await cli(['sheet', '-'], 'Linh\n'.repeat(20_000))
      expect(r.code).toBe(1)
      expect(r.out.length).toBe(0)
      expect(r.err).toBe(limit)
    })

    test('exactly 64 KiB still draws', async () => {
      const r = await cli(['sheet', ok])
      expect(r.code).toBe(0)
      expect(r.text.match(/<svg /g)?.length).toBe(3)
    })
  })

  test('an unreadable sheet file says why', async () => {
    const r = await cli(['sheet', '/no/such/file'])
    expect(r.err).toContain('ENOENT')
  })

  // /dev/full is Linux only
  test.skipIf(!existsSync('/dev/full'))(
    'a failing stdout is one line and non-zero',
    async () => {
      const p = Bun.spawn(['sh', '-c', `node ${bin} Linh > /dev/full`], {
        stderr: 'pipe',
      })
      const err = await new Response(p.stderr).text()
      expect(await p.exited).toBe(1)
      expect(err).toBe('awflow-avatar: cannot write output: ENOSPC\n')
    },
  )
})
