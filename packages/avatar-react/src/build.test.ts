/*
 * The published build: an RSC framework (Next.js) must see the component
 * as a client module, so dist/index.js opens with 'use client'. Runs
 * against the last build (`bun run build`); skipped before the first one.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const built = join(process.cwd(), 'dist/index.js')

test.skipIf(!existsSync(built))('dist/index.js starts with use client', () => {
  expect(readFileSync(built, 'utf8')).toMatch(/^['"]use client['"];?\n/)
})
