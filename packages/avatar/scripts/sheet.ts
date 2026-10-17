/* A tuning sheet: every shape in three expressions, for looking at anchors.
 * Run `bun scripts/sheet.ts`, then
 * `rsvg-convert scratch/shapes.svg -o scratch/shapes.png`. */
import { mkdir, writeFile } from 'node:fs/promises'
import { LISTS } from '../src/identity'
import { toSvg } from '../src/svg'
import { type Expression, INK } from '../src/tables'

const SIZE = 300
const LABEL = 32
const EXPR: Expression[] = ['normal', 'happy', 'surprised']
const TRAITS = ['square', 'fin', 'ring', 'dot', 'peak'] as const

const shapes = LISTS.face
const cols = EXPR.length * 2
const rows = Math.ceil(shapes.length / 2)
const w = cols * SIZE
const h = rows * (SIZE + LABEL)
const tiles: string[] = []
const labels: string[] = []
shapes.forEach((shape, s) => {
  EXPR.forEach((expression, e) => {
    const i = s * EXPR.length + e
    const x = (i % cols) * SIZE
    const y = Math.floor(i / cols) * (SIZE + LABEL)
    const trait = TRAITS[(s + e) % TRAITS.length]
    tiles.push(
      toSvg(`sheet ${shape}`, {
        shape,
        expression,
        trait,
        cheeks: 'oval',
        brows: 'arch',
        size: SIZE,
      }).replace('<svg ', `<svg x="${x}" y="${y}" `),
    )
    labels.push(
      `<text x="${x + SIZE / 2}" y="${y + SIZE + 21}">${shape} · ${expression} · ${trait}</text>`,
    )
  })
})
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${INK.ink}"/>${tiles.join('')}<g font-family="Menlo, monospace" font-size="15" fill="${INK.bone}" text-anchor="middle">${labels.join('')}</g></svg>\n`
const dir = new URL('../scratch/', import.meta.url)
await mkdir(dir, { recursive: true })
await writeFile(new URL('shapes.svg', dir), svg)
