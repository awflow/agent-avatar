/* A tuning sheet for the face parts past Peek's: each new part on a few
 * shapes in all 11 expressions. Run `bun scripts/parts.ts`, then
 * `rsvg-convert scratch/parts.svg -o scratch/parts.png`. */
import { mkdir, writeFile } from 'node:fs/promises'
import type { AvatarOptions } from '../src/svg'
import { toSvg } from '../src/svg'
import { EXPRESSIONS, type Expression, type Face, INK } from '../src/tables'

const SIZE = 160
const LABEL = 150
const EXPR = Object.keys(EXPRESSIONS) as Expression[]
const FACES: Face[] = ['circle', 'diamond', 'ghost']
const NONE = { brows: 'none', cheeks: 'none', trait: 'none' } as const
const ROWS: [string, AvatarOptions][] = []
for (const eyes of ['pill', 'dot', 'spark'] as const)
  for (const shape of FACES)
    ROWS.push([`${eyes} ${shape}`, { eyes, shape, mouth: 'line' }])
for (const shape of FACES)
  ROWS.push([`cat ${shape}`, { mouth: 'cat', eyes: 'oval', shape }])
ROWS.push([
  'all none',
  { ...NONE, mouth: 'none', eyes: 'pill', shape: 'circle' },
])
ROWS.push([
  'bold pill',
  { ...NONE, mouth: 'cat', eyes: 'spark', shape: 'blob' },
])

const w = LABEL + EXPR.length * SIZE
const h = ROWS.length * SIZE + 30
const out: string[] = []
const tiles: string[] = []
EXPR.forEach((e, c) => {
  out.push(`<text x="${LABEL + c * SIZE + SIZE / 2}" y="20">${e}</text>`)
})
ROWS.forEach(([label, o], r) => {
  const y = 30 + r * SIZE
  out.push(`<text x="${LABEL / 2}" y="${y + SIZE / 2}">${label}</text>`)
  EXPR.forEach((expression, c) => {
    tiles.push(
      toSvg('parts sheet', { ...o, expression, size: SIZE - 8 }).replace(
        '<svg ',
        `<svg x="${LABEL + c * SIZE + 4}" y="${y + 4}" `,
      ),
    )
  })
})
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${INK.ink}"/>${tiles.join('')}<g font-family="Menlo, monospace" font-size="14" fill="${INK.bone}" text-anchor="middle">${out.join('')}</g></svg>\n`
const dir = new URL('../scratch/', import.meta.url)
await mkdir(dir, { recursive: true })
await writeFile(new URL('parts.svg', dir), svg)
