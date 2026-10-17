/* A tuning sheet for full framing, the size ladder and the ring: every shape
 * framed whole with a hat on no frame, then a size ladder per theme, then
 * rings. Run `bun scripts/framing.ts`, then
 * `rsvg-convert -z 2 scratch/framing.svg -o scratch/framing.png`. */
import { mkdir, writeFile } from 'node:fs/promises'
import { LISTS } from '../src/identity'
import { toSvg } from '../src/svg'
import { INK } from '../src/tables'

const CELL = 140
const LABEL = 22
const out: string[] = []
let y = 10
const put = (
  x: number,
  size: number,
  name: string,
  o: Parameters<typeof toSvg>[1],
  text: string,
) => {
  out.push(
    `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="none" stroke="#bbb" stroke-dasharray="3 3"/>`,
    toSvg(name, { ...o, size }).replace('<svg ', `<svg x="${x}" y="${y}" `),
    `<text x="${x + size / 2}" y="${y + size + 16}">${text}</text>`,
  )
}

// every shape, whole, on no frame, with a cap or a sprout
LISTS.face.forEach((shape, i) => {
  if (i && i % 8 === 0) y += CELL + LABEL + 10
  put(
    10 + (i % 8) * (CELL + 10),
    CELL,
    `full ${i}`,
    {
      shape,
      framing: 'full',
      frame: 'none',
      headwear: i % 2 ? 'sprout' : 'cap',
      theme: i % 3 === 0 ? 'clay' : 'bold',
    },
    shape,
  )
})
y += CELL + LABEL + 20

// the size ladder, peek and full, a few themes
for (const theme of ['bold', 'clay', 'soft']) {
  let x = 10
  for (const framing of ['peek', 'full'] as const)
    for (const size of [16, 24, 32, 48, 96]) {
      put(
        x,
        size,
        'Linh',
        { theme, framing, size, headwear: 'cap', motif: 'dots' },
        `${size}`,
      )
      x += size + 14
    }
  y += 96 + LABEL + 10
}

// rings
const rings = [
  { color: '#F08A24' },
  { color: '#F08A24', progress: 0.62 },
  { color: '#2BB673', progress: 0.25 },
  { color: '#3D7BF0', progress: 0 },
]
rings.forEach((ring, i) => {
  put(
    10 + i * (CELL + 10),
    CELL,
    `ring ${i}`,
    { ring },
    `${ring.progress ?? 1}`,
  )
})
put(
  10 + 4 * (CELL + 10),
  CELL,
  'ring c',
  { ring: rings[1], square: false },
  'round',
)
put(
  10 + 5 * (CELL + 10),
  CELL,
  'ring f',
  { ring: rings[1], framing: 'full', theme: 'clay' },
  'full clay',
)
y += CELL + LABEL + 10

const W = 10 + 8 * (CELL + 10)
await mkdir('scratch', { recursive: true })
await writeFile(
  'scratch/framing.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" font-family="sans-serif" font-size="12" text-anchor="middle"><rect width="100%" height="100%" fill="${INK.bone}"/>${out.join('')}</svg>`,
)
