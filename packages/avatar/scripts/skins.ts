/* A tuning sheet for motifs and themes: every motif on a few shapes in Bold,
 * then every theme on a few shapes. Run `bun scripts/skins.ts`, then
 * `rsvg-convert scratch/skins.svg -o scratch/skins.png`. */
import { mkdir, writeFile } from 'node:fs/promises'
import { LISTS } from '../src/identity'
import { toSvg } from '../src/svg'
import { INK } from '../src/tables'
import { THEMES } from '../src/themes'

const SIZE = 220
const LABEL = 28
const SHAPES = [
  'circle',
  'triangle',
  'arch',
  'ghost',
  'semicircle',
  'cloud',
  'diamond',
] as const
const tiles: string[] = []
const labels: string[] = []
let row = 0
const put = (
  col: number,
  name: string,
  o: Parameters<typeof toSvg>[1],
  text: string,
) => {
  const x = col * SIZE
  const y = row * (SIZE + LABEL)
  tiles.push(
    toSvg(name, { ...o, size: SIZE }).replace(
      '<svg ',
      `<svg x="${x}" y="${y}" `,
    ),
  )
  labels.push(`<text x="${x + SIZE / 2}" y="${y + SIZE + 19}">${text}</text>`)
}
for (const motif of LISTS.motif) {
  SHAPES.forEach((shape, c) => {
    put(
      c,
      `skin ${shape}`,
      { theme: 'bold', motif, shape },
      `${motif} · ${shape}`,
    )
  })
  row++
}
for (const theme of Object.keys(THEMES)) {
  SHAPES.forEach((shape, c) => {
    const motif = theme === 'soft' || theme === 'clay' ? 'plain' : 'dots'
    put(c, `skin ${shape}`, { theme, shape, motif }, `${theme} · ${shape}`)
  })
  row++
}
const w = SHAPES.length * SIZE
const h = row * (SIZE + LABEL)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${INK.ink}"/>${tiles.join('')}<g font-family="Menlo, monospace" font-size="14" fill="${INK.bone}" text-anchor="middle">${labels.join('')}</g></svg>\n`
const dir = new URL('../scratch/', import.meta.url)
await mkdir(dir, { recursive: true })
await writeFile(new URL('skins.svg', dir), svg)
