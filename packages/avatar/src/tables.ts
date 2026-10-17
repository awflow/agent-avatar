/*
 * The peek style's tables. Faces, inks and expressions are transcribed from
 * the Peek v1.2 page (peek.html); the new part types are drawn in the same
 * language and driven by the same channels.
 *
 * Every list is append-only and ordered: object key order is list order, and
 * the hash indexes into it. Never reorder or remove an entry. A version pins
 * how much of each list it may pick from (VERSIONS), so growing a list means
 * a new version, never a new result for an old one.
 */

type Pt = readonly [number, number]

/** Structure inks: never a body color. Signal stays in the interface. */
export const INK = {
  ink: '#1A1918',
  bone: '#F3F0E8',
  paper: '#FFFDF8',
} as const

export type FaceGeom = {
  /** `stroke` rounds the corners: a round-join outline in the body ink. */
  body:
    | { readonly d: string; readonly stroke?: number }
    | { readonly circle: readonly [number, number, number] }
  bottom: number
  /** How far the body sinks below the floor at rest. */
  sink: number
  eyes: readonly [Pt, Pt]
  rx: number
  ry: number
  pr: number
  brow: {
    readonly y: number
    readonly hw: number
    readonly arch: number
    readonly w: number
  }
  cheeks: readonly [Pt, Pt]
  crx: number
  cry: number
  mouth: {
    readonly x: number
    readonly y: number
    readonly w: number
    readonly d: number
    readonly sw: number
  }
  /**
   * The crown: the visible outline above the eyes, as a convex polygon grown
   * by `r` (a point grown by r is a circle). `poly[0]` is the top and the
   * polygon runs clockwise. Every trait sits on this outline, so any trait
   * fits any face.
   */
  crown: { readonly poly: readonly Pt[]; readonly r: number }
  /** Head half-width at the crown: hats scale by clamp(hw / 88, 0.55, 1.2). */
  hw: number
  /** Half-width at the eye line: where headphones and temples sit. */
  side: number
  /** The neckwear line. */
  neck: number
}

const FACES_V1 = {
  diamond: {
    body: { d: 'M170 20L320 170L170 320L20 170Z' },
    bottom: 320,
    sink: 30,
    eyes: [
      [132.5, 155],
      [207.5, 155],
    ],
    rx: 20,
    ry: 27.5,
    pr: 10,
    brow: { y: 102.5, hw: 18.75, arch: 15, w: 5.62 },
    cheeks: [
      [117.5, 200],
      [222.5, 200],
    ],
    crx: 11.25,
    cry: 5.62,
    mouth: { x: 170, y: 218.75, w: 15, d: 16.25, sw: 4.38 },
    crown: {
      poly: [
        [170, 20],
        [320, 170],
        [170, 320],
        [20, 170],
      ],
      r: 0,
    },
    hw: 30,
    side: 133,
    neck: 243.75,
  },
  semicircle: {
    body: { d: 'M0 255A170 170 0 0 1 340 255Z' },
    bottom: 255,
    sink: 0,
    eyes: [
      [102.5, 175],
      [237.5, 175],
    ],
    rx: 30,
    ry: 25,
    pr: 11.25,
    brow: { y: 127.5, hw: 25, arch: 15, w: 5.62 },
    cheeks: [
      [55, 212.5],
      [285, 212.5],
    ],
    crx: 11.25,
    cry: 5.62,
    mouth: { x: 170, y: 221.25, w: 16.25, d: 16.25, sw: 4.38 },
    crown: { poly: [[170, 255]], r: 170 },
    hw: 102,
    side: 160,
    neck: 246.25,
  },
  circle: {
    body: { circle: [170, 170, 150] },
    bottom: 320,
    sink: 20,
    eyes: [
      [112.8, 162.2],
      [227.2, 162.2],
    ],
    rx: 29.9,
    ry: 29.9,
    pr: 13,
    brow: { y: 110.2, hw: 23.4, arch: 15.6, w: 5.85 },
    cheeks: [
      [84.2, 203.8],
      [255.8, 203.8],
    ],
    crx: 11.7,
    cry: 5.85,
    mouth: { x: 170, y: 223.3, w: 16.9, d: 16.9, sw: 4.55 },
    crown: { poly: [[170, 170]], r: 150 },
    hw: 88,
    side: 150,
    neck: 248.3,
  },
  /* The v2.1 spec (M50 12L92 88H8Z on a 100u grid, 8u round joins, eyes at
   * 62u) scaled x3.4 about the centre. */
  triangle: {
    body: { d: 'M170 40.8L312.8 299.2L27.2 299.2Z', stroke: 27.2 },
    bottom: 312.8,
    sink: 0,
    eyes: [
      [132.6, 210.8],
      [207.4, 210.8],
    ],
    rx: 20.4,
    ry: 27.2,
    pr: 10,
    brow: { y: 166.6, hw: 18.7, arch: 15.3, w: 5.62 },
    cheeks: [
      [98.6, 238],
      [241.4, 238],
    ],
    crx: 11.5,
    cry: 5.75,
    mouth: { x: 170, y: 254, w: 17, d: 16.25, sw: 4.38 },
    crown: {
      poly: [
        [170, 40.8],
        [312.8, 299.2],
        [27.2, 299.2],
      ],
      r: 13.6,
    },
    hw: 20,
    side: 95,
    neck: 279,
  },
} as const satisfies Record<string, FaceGeom>

/* ---------- the 11 shapes appended for peek@2 ---------- */

/* They are drawn on the mock prototype's 100-unit grid and scaled x3.4 into
 * the 340-unit frame at module load. Every number is rounded to 0.01, so
 * the scaled geometry is the same bytes on every engine. */
const K = 3.4
const r2 = (v: number) => Math.round(v * 100) / 100 || 0
const k = (v: number) => r2(v * K)

/** Scales a path from the 100-unit grid: arc radii yes, arc flags never. */
function scalePath(d: string): string {
  let cmd = ''
  let i = 0
  return d.replace(/([A-Za-z])|(-?(?:\d+\.?\d*|\.\d+))/g, (m, c?: string) => {
    if (c) {
      cmd = c
      i = 0
      return c
    }
    const flag = (cmd === 'a' || cmd === 'A') && i % 7 >= 2 && i % 7 <= 4
    i++
    return flag ? m : String(k(Number(m)))
  })
}

const RAD100 = Math.PI / 180
const polar = (r: number, deg: number): Pt => [
  50 + r * Math.cos(deg * RAD100),
  50 + r * Math.sin(deg * RAD100),
]

/** n arcs of radius r between n points on a ring of radius R about the centre. */
function ring(n: number, R: number, from: number, r: number, large: 0 | 1) {
  const pts = Array.from({ length: n }, (_, i) =>
    polar(R, from + (360 / n) * i),
  )
  const at = ([x, y]: Pt) => `${k(x)} ${k(y)}`
  const arcs = pts.map(
    (_, i) => `A${k(r)} ${k(r)} 0 ${large} 1 ${at(pts[(i + 1) % n]!)}`,
  )
  return `M${at(pts[0]!)}${arcs.join('')}Z`
}

/** Where the bulge of an arc of radius r over a ring's chord is centred. */
function bumps(n: number, R: number, from: number, r: number, large: 0 | 1) {
  const half = 180 / n
  const mid = R * Math.cos(half * RAD100)
  const off = Math.sqrt(r * r - (R * Math.sin(half * RAD100)) ** 2)
  const c = large ? mid + off : mid - off
  return Array.from(
    { length: n },
    (_, i): Pt => polar(c, from + half + (360 / n) * i),
  )
}

type Spec = {
  /** The body path on the 100-unit grid, or one already in 340 units. */
  body: string | { readonly d: string; readonly stroke: number }
  ey: number
  dx: number
  rx: number
  ry: number
  by: number
  my: number
  cx: number
  cy: number
  top: number
  bottom: number
  side: number
  hw: number
  /** The crown on the 100-unit grid: poly[0] on top, clockwise. */
  crown: { readonly poly: readonly Pt[]; readonly r: number }
}

/** A face from its mock anchors, every FaceGeom field derived by one rule. */
function shape(o: Spec, scaled = false): FaceGeom {
  const d = typeof o.body === 'string' ? o.body : o.body.d
  const body = {
    d: scaled ? d : scalePath(d),
    ...(typeof o.body === 'string' ? {} : { stroke: k(o.body.stroke) }),
  }
  const ey = k(o.ey)
  const my = k(o.my)
  return {
    body,
    bottom: k(o.bottom),
    sink: k(o.top) < 51 ? 30 : 0,
    eyes: [
      [k(50 - o.dx), ey],
      [k(50 + o.dx), ey],
    ],
    rx: k(o.rx),
    ry: k(o.ry),
    pr: r2(0.52 * o.rx * K),
    brow: { y: k(o.by), hw: r2(0.95 * o.rx * K), arch: 15, w: 5.62 },
    cheeks: [
      [k(50 - o.cx), k(o.cy)],
      [k(50 + o.cx), k(o.cy)],
    ],
    crx: 11.25,
    cry: 5.62,
    mouth: { x: 170, y: my, w: 16, d: 16.25, sw: 4.38 },
    crown: {
      poly: o.crown.poly.map(([x, y]): Pt => [k(x), k(y)]),
      r: k(o.crown.r),
    },
    hw: k(o.hw),
    side: k(o.side),
    neck: r2(my + 25),
  }
}

// cloud: 8 bumps on a ring of 36; flower: 6 petals on a ring of 28
const CLOUD = ring(8, 36, -90, 15, 0)
const CLOUD_C = bumps(8, 36, -90, 15, 0)
const FLOWER = ring(6, 28, -60, 15, 1)
const FLOWER_C = bumps(6, 28, -60, 15, 1)
// poly[0] is the top: between the cloud's two top bumps, the flower's top petal
const cloudTop: Pt = [50, (CLOUD_C[0]![1] + CLOUD_C[7]![1]) / 2]
const flowerCrown = [...FLOWER_C.slice(5), ...FLOWER_C.slice(0, 5)]

const FACES_V2 = {
  cube: shape({
    body: 'M30 6h40a24 24 0 0 1 24 24v40a24 24 0 0 1-24 24H30A24 24 0 0 1 6 70V30A24 24 0 0 1 30 6z',
    ey: 46,
    dx: 17,
    rx: 7.6,
    ry: 8.4,
    by: 32,
    my: 66,
    cx: 27,
    cy: 61,
    top: 6,
    bottom: 94,
    side: 44,
    hw: 32,
    crown: {
      poly: [
        [50, 30],
        [70, 30],
        [70, 70],
        [30, 70],
        [30, 30],
      ],
      r: 24,
    },
  }),
  drop: shape({
    body: 'M50 4c13 17 38 32 38 53a38 38 0 0 1-76 0C12 36 37 21 50 4z',
    ey: 58,
    dx: 13,
    rx: 6.8,
    ry: 7.6,
    by: 45,
    my: 74,
    cx: 24,
    cy: 69,
    top: 4,
    bottom: 95,
    side: 37,
    hw: 8,
    // the hull of the outline: the tip, points on the shoulders, the bowl
    crown: {
      poly: [
        [50, 4],
        [73.9, 29],
        [83.9, 42.3],
        [88, 57],
        [82.9, 76],
        [69, 90],
        [50, 95],
        [31, 90],
        [17.1, 76],
        [12, 57],
        [16.1, 42.3],
        [26.1, 29],
      ],
      r: 0,
    },
  }),
  gem: shape({
    body: 'M41 9a13 13 0 0 1 18 0l32 32a13 13 0 0 1 0 18L59 91a13 13 0 0 1-18 0L9 59a13 13 0 0 1 0-18z',
    ey: 47,
    dx: 13,
    rx: 6.5,
    ry: 7.6,
    by: 33,
    my: 64,
    cx: 21,
    cy: 59,
    top: 5,
    bottom: 95,
    side: 40,
    hw: 11,
    crown: {
      poly: [
        [50, 18.38],
        [81.62, 50],
        [50, 81.62],
        [18.38, 50],
      ],
      r: 13,
    },
  }),
  cloud: shape(
    {
      body: CLOUD,
      ey: 48,
      dx: 14,
      rx: 7,
      ry: 7.6,
      by: 34,
      my: 64,
      cx: 24,
      cy: 59,
      top: 7,
      bottom: 93,
      side: 40,
      hw: 22,
      crown: { poly: [cloudTop, ...CLOUD_C], r: 15 },
    },
    true,
  ),
  ghost: shape({
    body: 'M50 6C74 6 92 24 92 48V88L80 80L68 90L56 80L44 90L32 80L20 90L8 82V48C8 24 26 6 50 6Z',
    ey: 44,
    dx: 15,
    rx: 7.2,
    ry: 8,
    by: 30,
    my: 61,
    cx: 25,
    cy: 56,
    top: 6,
    bottom: 90,
    side: 42,
    hw: 26,
    crown: { poly: [[50, 48]], r: 42 },
  }),
  peak: shape({
    body: 'M42 12c4-7 12-7 16 0l36 66c4 8-1 16-10 16H16c-9 0-14-8-10-16z',
    ey: 64,
    dx: 11,
    rx: 6,
    ry: 7,
    by: 52,
    my: 77,
    cx: 22,
    cy: 73,
    top: 7,
    bottom: 94,
    side: 30,
    hw: 7,
    crown: {
      poly: [
        [50, 16.1],
        [87.6, 85],
        [12.4, 85],
      ],
      r: 9,
    },
  }),
  blob: shape({
    body: 'M50 7C72 6 93 22 92 47C91 72 76 93 50 93C24 93 8 74 8 50C8 25 28 8 50 7Z',
    ey: 46,
    dx: 16,
    rx: 7.8,
    ry: 8.4,
    by: 31,
    my: 65,
    cx: 26,
    cy: 60,
    top: 7,
    bottom: 93,
    side: 42,
    hw: 25,
    crown: { poly: [[50, 50]], r: 42.5 },
  }),
  capsule: shape({
    body: 'M50 4a28 28 0 0 1 28 28v36a28 28 0 0 1-56 0V32A28 28 0 0 1 50 4z',
    ey: 40,
    dx: 11,
    rx: 5.8,
    ry: 6.6,
    by: 28,
    my: 56,
    cx: 18,
    cy: 51,
    top: 4,
    bottom: 96,
    side: 28,
    hw: 20,
    crown: {
      poly: [
        [50, 32],
        [50, 68],
      ],
      r: 28,
    },
  }),
  bean: shape({
    body: 'M28 24h44a26 26 0 0 1 0 52H28a26 26 0 0 1 0-52z',
    ey: 46,
    dx: 18,
    rx: 7,
    ry: 7.4,
    by: 34,
    my: 61,
    cx: 31,
    cy: 57,
    top: 24,
    bottom: 76,
    side: 48,
    hw: 32,
    crown: {
      poly: [
        [50, 50],
        [72, 50],
        [28, 50],
      ],
      r: 26,
    },
  }),
  arch: shape({
    body: { d: 'M14 92V48a36 36 0 0 1 72 0v44z', stroke: 5 },
    ey: 50,
    dx: 15,
    rx: 7,
    ry: 8,
    by: 36,
    my: 68,
    cx: 24,
    cy: 63,
    top: 12,
    bottom: 92,
    side: 36,
    hw: 24,
    // the dome, grown by half the round-join stroke
    crown: { poly: [[50, 48]], r: 38.5 },
  }),
  flower: shape(
    {
      body: FLOWER,
      ey: 48,
      dx: 13,
      rx: 6.6,
      ry: 7.2,
      by: 35,
      my: 63,
      cx: 22,
      cy: 58,
      top: 6,
      bottom: 94,
      side: 40,
      hw: 14,
      crown: { poly: flowerCrown, r: 15 },
    },
    true,
  ),
} as const satisfies Record<string, FaceGeom>

export const FACES = {
  ...FACES_V1,
  ...FACES_V2,
} as const satisfies Record<string, FaceGeom>

/**
 * Body inks, each with a deep partner at the same hue. The body fills the
 * face and the lids, the deep ink carries cheeks and trait. The first four
 * are from v1.2; butter, rose and aqua are provisional, matched to the same
 * OKLCH lightness and chroma.
 */
export const COLORS = {
  lavender: { body: '#D8CDF0', deep: '#BDAEE6' },
  fog: { body: '#C8D6E8', deep: '#A8BCDC' },
  clay: { body: '#F1CDBF', deep: '#E2A893' },
  mint: { body: '#CFE7D6', deep: '#A5CDB1' },
  butter: { body: '#ECE2B9', deep: '#D9C284' },
  rose: { body: '#EFCAD7', deep: '#DFA4BA' },
  aqua: { body: '#BDE1E5', deep: '#8FC7D1' },
  // appended for @awflow/avatar; peek@1 never picks past aqua (VERSIONS)
  peach: { body: '#F6D3B8', deep: '#E8B08A' },
  sky: { body: '#C9E2F5', deep: '#9EC6E8' },
  sage: { body: '#DCE5C8', deep: '#B9CA98' },
  sand: { body: '#E8DCCB', deep: '#CDB99C' },
  plum: { body: '#E2CFE6', deep: '#C7A7CF' },
} as const

/** Discrete anatomy. Each part reads every channel its feature owns. */
export const PARTS = {
  eyes: ['oval', 'bead', 'ring', 'pill', 'dot', 'spark'],
  brows: ['arch', 'bar', 'wedge', 'dash', 'none'],
  mouth: ['poly', 'round', 'line', 'box', 'cat', 'none'],
  cheeks: ['oval', 'dots', 'lines', 'none'],
  trait: ['square', 'fin', 'ring', 'dot', 'peak', 'none'],
  motif: [
    'plain',
    'dots',
    'stripes',
    'waves',
    'grid',
    'speckle',
    'glow',
    'rays',
  ],
} as const

// The bow's single warm accent, transcribed from the accessory sheet.
export const ACCESSORY_INK = { knot: '#E5412D' } as const

/** Independent wardrobe slots. peek@1 picks none; callers can dress it. */
export const ACCESSORIES = {
  eyewear: [
    'none',
    'glasses',
    'sunglasses',
    'monocle',
    'visor',
    'patch',
    'cateye',
  ],
  headwear: [
    'none',
    'bow',
    'cap',
    'sprout',
    'beanie',
    'headphones',
    'antenna',
    'crown',
    'wizard',
    'party',
    'halo',
    'beret',
    'chef',
  ],
  neckwear: ['none', 'tie', 'bowtie', 'scarf', 'necklace', 'badge'],
  decor: ['none', 'freckles', 'mustache', 'bandaid', 'sticker'],
} as const
export type Eyewear = (typeof ACCESSORIES.eyewear)[number]
export type Headwear = (typeof ACCESSORIES.headwear)[number]
export type Neckwear = (typeof ACCESSORIES.neckwear)[number]
export type Decor = (typeof ACCESSORIES.decor)[number]
export type AccessorySlot = keyof typeof ACCESSORIES

/** Hand-held props. Never hashed: only a caller picks one (drawn from Plan 3). */
export const PROPS = [
  'none',
  'magnifier',
  'pencil',
  'coffee',
  'bulb',
  'book',
  'wrench',
] as const
export type Prop = (typeof PROPS)[number]

export type Face = keyof typeof FACES
export type Color = keyof typeof COLORS
export type Part = keyof typeof PARTS
export type Eyes = (typeof PARTS.eyes)[number]
export type Brows = (typeof PARTS.brows)[number]
export type Mouth = (typeof PARTS.mouth)[number]
export type Cheeks = (typeof PARTS.cheeks)[number]
export type Trait = (typeof PARTS.trait)[number]
export type Motif = (typeof PARTS.motif)[number]
export type Axis = 'face' | 'color' | Part | AccessorySlot

/** How much of each list a version may pick from. Append-only too. */
export const VERSIONS: Record<number, Record<Axis, number>> = {
  1: {
    face: 4,
    color: 7,
    eyes: 3,
    brows: 4,
    mouth: 4,
    cheeks: 3,
    trait: 5,
    eyewear: 1,
    headwear: 1,
    neckwear: 1,
    motif: 1,
    decor: 1,
  },
  2: {
    face: 15,
    color: 12,
    eyes: 6,
    brows: 4,
    mouth: 5,
    cheeks: 3,
    trait: 5,
    motif: 7,
    eyewear: 1,
    headwear: 1,
    neckwear: 1,
    decor: 1,
  },
}
/**
 * How many entries of each wardrobe list a dressed identity (v2+) rolls past
 * 'none'. Pinned per version so appending wardrobe items never moves a face.
 */
export const DRESS: Record<
  number,
  Record<'headwear' | 'eyewear' | 'neckwear' | 'decor', number>
> = {
  2: { headwear: 13, eyewear: 7, neckwear: 6, decor: 5 },
}
export const LATEST = 2

/* ---------- state: channels and the 11 expressions ---------- */

export const GROUPS = {
  eyes: ['lid', 'lower', 'lidTilt', 'eyeS', 'lidAsym', 'winkR'],
  pupil: ['pupil', 'gx', 'gy', 'shine'],
  brows: ['browY', 'browTilt', 'browArch', 'browW', 'browAsym'],
  mouth: ['mw', 'mt', 'mb', 'mx', 'my', 'mk'],
  body: ['alt', 'rot', 'x', 'sx', 'sy'],
  extra: ['blush', 'hair', 'dim', 'thing'],
} as const
export type Group = keyof typeof GROUPS
export type Channel = (typeof GROUPS)[Group][number]
export type Channels = Record<Channel, number>

const BASE: Channels = {
  alt: 0,
  rot: 0,
  x: 0,
  sx: 1,
  sy: 1,
  lid: 0.1,
  lower: 0,
  lidTilt: 0,
  eyeS: 1,
  lidAsym: 0,
  // the right eye's own lid, for a wink; the lid it shows is the larger
  winkR: 0,
  pupil: 1,
  gx: 0,
  gy: 0,
  shine: 0.7,
  browY: 0,
  browTilt: 0,
  browArch: 0.4,
  browW: 1,
  browAsym: 0,
  mw: 0.72,
  mt: 0,
  mb: 0.5,
  mx: 0,
  my: 0,
  mk: 0,
  blush: 0,
  hair: 0,
  dim: 0,
  thing: 0,
}

const S = (o: Partial<Channels>): Readonly<Channels> => ({ ...BASE, ...o })
export const EXPRESSIONS = {
  normal: S({}),
  happy: S({
    lid: 0,
    lower: 0.42,
    shine: 1,
    gy: -0.05,
    browY: -5,
    browArch: 1,
    mw: 1,
    mb: 1,
    blush: 1,
    hair: 0.45,
    alt: 0.05,
  }),
  sad: S({
    lid: 0.42,
    lidTilt: 16,
    pupil: 0.95,
    gy: 0.8,
    shine: 0,
    browY: 3,
    browTilt: 14,
    browArch: 0,
    mw: 0.8,
    mt: -0.55,
    mb: -0.55,
    my: 6,
    alt: -0.16,
    sy: 0.985,
    hair: -0.75,
  }),
  angry: S({
    lid: 0.34,
    lidTilt: -22,
    lower: 0.12,
    pupil: 0.82,
    gy: 0.1,
    shine: 0,
    browY: 5,
    browTilt: -21,
    browArch: 0,
    browW: 1.3,
    mw: 0.8,
    mt: -0.08,
    mb: -0.08,
    my: 3,
    sx: 1.02,
    sy: 0.98,
    hair: 0.25,
  }),
  sleepy: S({
    lid: 1,
    lidTilt: 4,
    pupil: 0.9,
    gy: 0.5,
    shine: 0,
    browY: 6,
    browTilt: 3,
    browArch: 0.15,
    browW: 0.9,
    mw: 0.35,
    mt: -0.3,
    mb: 0.3,
    my: 2,
    alt: -1.12,
    rot: -3,
    hair: -1,
  }),
  curious: S({
    lid: 0,
    eyeS: 1.06,
    pupil: 1.05,
    shine: 1,
    browY: -3,
    browAsym: 9,
    browArch: 0.8,
    mw: 0.38,
    mt: -0.36,
    mb: 0.36,
    rot: 6,
    alt: -0.32,
    hair: 0.3,
    thing: 1,
  }),
  surprised: S({
    lid: 0,
    eyeS: 1.2,
    pupil: 0.66,
    shine: 0.8,
    browY: -13,
    browArch: 1,
    mw: 0.55,
    mt: -0.62,
    mb: 0.62,
    alt: 0.36,
    hair: 1,
  }),
  excited: S({
    lid: 0,
    lower: 0.5,
    eyeS: 1.08,
    pupil: 1.08,
    shine: 1,
    browY: -9,
    browArch: 1,
    mw: 1.15,
    mb: 1.3,
    blush: 1,
    hair: 1,
    alt: 0.12,
  }),
  confused: S({
    lid: 0.22,
    lidAsym: 0.28,
    lidTilt: -4,
    pupil: 0.92,
    gx: -0.35,
    gy: -0.45,
    shine: 0.3,
    browY: -2,
    browAsym: 11,
    browTilt: -5,
    browArch: 0.3,
    mw: 0.6,
    mt: -0.1,
    mb: 0.12,
    mx: 5,
    mk: 13,
    rot: -7,
    alt: -0.05,
    hair: 0.1,
  }),
  bored: S({
    lid: 0.5,
    pupil: 0.9,
    gx: -0.55,
    gy: 0.25,
    shine: 0,
    browY: 3,
    browArch: 0.1,
    mw: 0.55,
    mt: 0,
    mb: 0.04,
    mx: -5,
    alt: -0.34,
    hair: -0.45,
    dim: 1,
  }),
  attentive: S({
    lid: 0,
    eyeS: 1.1,
    pupil: 0.8,
    gy: -0.1,
    shine: 1,
    browY: -7,
    browArch: 0.7,
    mw: 0.55,
    mb: 0.4,
    alt: 0.15,
    sy: 1.03,
    hair: 0.65,
  }),
} as const
export type Expression = keyof typeof EXPRESSIONS
