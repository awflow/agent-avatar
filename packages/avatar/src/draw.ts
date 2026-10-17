/*
 * One pure geometry function: an identity and a pose in, a plain node tree
 * out. The per-frame drawing is transcribed from render() in the v1.2 page,
 * so a static frame of an expression is the pose the rig settles to. The
 * animator calls the same function every frame and writes the difference.
 *
 * Structure depends only on the identity and the options, never the pose,
 * so a live tree keeps the same nodes frame to frame. A static tree drops
 * what is invisible (opacity 0) to stay small.
 */

import { ACTIVITIES, type Activity, activityLoop, blend } from './activity'
import { FX_KINDS, FX_POOL, FX_POOL_SMALL, type FxKind, fxShapes } from './fx'
import { clamp, depth, RAD, seat, smooth } from './geom'
import { type Axes, fnv1a, mulberry32, type Persona } from './identity'
import { type Attrs, type Node, n, prune } from './node'
import {
  accessoryOf,
  drawPlugin,
  fxOf,
  fxPluginShapes,
  geomOf,
  propOf,
} from './plugins'
import {
  ACCESSORY_INK,
  type Channel,
  type Channels,
  COLORS,
  type Expression,
  type FaceGeom,
  INK,
} from './tables'
import { type Ink, THEMES, type Theme } from './themes'
import { WEAR, type WearCtx, type WearSlot } from './wardrobe/context'
import {
  HELD_PROPS,
  type PropBound,
  type PropName,
  propSpot,
  swayed,
} from './wardrobe/props'

export { clamp, depth, seat, smooth } from './geom'

export type { Node } from './node'

// perceived lightness of a #rrggbb fill, 0..1
const luma = (hex: string) => {
  const v = Number.parseInt(hex.slice(1), 16)
  return (
    (0.2126 * (v >> 16) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255
  )
}

export type Frame = 'ink' | 'bone' | 'paper' | 'none' | 'theme'
/** 'peek' crops the body at the floor; 'full' shows all of it, hat room too. */
export type Framing = 'peek' | 'full'
/** A presence ring on the frame. `pulse` animates from Plan 2. */
export type Ring = { color: string; progress?: number; pulse?: boolean }
export type Gaze = readonly [x: number, y: number]

/** The static phase of every activity loop, in seconds. */
export const REST_T = 0.9

/**
 * Where an avatar sits on its activity loops, from its tidied name: a team
 * doing the same thing does not bob in step, and the server and the client
 * agree on it. Radians, 0..2π.
 */
export const loopPhase = (key = '') =>
  ((fnv1a(`${key}loop`) % 1000) / 1000) * 2 * Math.PI

export type Pose = Channels & {
  /** 0..1, the blink closing both lids. */
  blink: number
  /** The trait's lag behind the body, frame units, clamped to 16. */
  lag: number
  /** The ring thickens when angry: the one place a state is read by name. */
  expression: Expression
  /** What the agent is doing; layered over the expression. */
  activity: Activity
  /** Seconds on the activity loop clock; 0.9 is the static phase. */
  t: number
  /** Wobble energy for the live rig; 0 is still. */
  wob: number
  /** The overlay being drawn, if any: a built-in kind or a registered fx plugin. */
  fx: FxKind | (string & {}) | null
  /** 0..1 progress of that overlay. */
  fxP: number
  /** 0..1 mouth open from lip-sync, -1 for none. */
  voice: number
  /**
   * Per-wearable swing angles in degrees, for the slots whose items declare
   * their own spring. Absent by default; a slot left out reads `wob`.
   */
  swing?: Partial<Record<'headwear' | 'neckwear' | 'trait', number>>
}

export type DrawOptions = {
  /** Prefix for every id in the tree. Unique per avatar on a page. */
  id: string
  /** Rendered size in px: drives the stroke ramp and the riso print. */
  size: number
  frame: Frame
  /** The palette and structure inks. */
  theme?: Theme
  /** A resolved body ink (a hex colour) that replaces the theme's slot. */
  ink?: Ink
  /** false clips the frame to a circle. */
  square: boolean
  /** Riso plates, misregistration and grain. Fades out below 120px. */
  riso: boolean
  /** The accessible name; false marks the avatar decorative. */
  title: string | false
  /** Keep invisible nodes so an animator can write into them. */
  live?: boolean
  /** Default 'peek'. */
  framing?: Framing
  /** Default none. */
  ring?: Ring | null
  /** Level of detail from `size`. Off unless set (settle turns it on from v2). */
  lod?: boolean
  /**
   * false hides every overlay; true (the default) draws the activity's and
   * the reaction's; a string also draws that overlay by name.
   */
  fx?: boolean | string
}

/** `key` (the tidied name) seeds the speckle motif. */
export type Drawable = Axes & {
  persona: Persona
  key?: string
  /** The held prop, by name; never hashed. */
  prop?: string
}

/* The frame: viewBox -30 -30 400 400, the floor on its bottom edge. */
export const VB = [-30, -30, 400, 400] as const
const FLOOR = 370
const THING: Gaze = [330, 20]

const f2 = (v: number) => String(Math.round(v * 100) / 100)
const f3 = (v: number) => String(Math.round(v * 1000) / 1000)
const strokeFor = (px: number) =>
  px >= 96 ? 1 : px >= 56 ? 1.25 : px >= 40 ? 1.6 : px >= 30 ? 2 : 2.4
// hat room above the crown when the whole body is framed
const HEADROOM = 48
const FULL_SCALE = 0.8
const RING_R = 190
const RING_W = 12

/**
 * Level of detail, from the rendered size (never the pose, so a live tree
 * keeps its nodes): 2 draws everything; 1 (below 44px) drops brows, cheeks,
 * trait and prop; 0 (below 24px) keeps only the body and the eyes.
 */
export const tierOf = (px: number, lod = true): 0 | 1 | 2 =>
  !lod ? 2 : px < 24 ? 0 : px < 44 ? 1 : 2
// the sprout, drawn upward from where it is planted
const STEM = 'M0 0Q3 -19 0 -36'
const LEAF0 = 'M0 -33C-24 -30 -38 -52 -25 -53C-12 -54 -2 -43 0 -33Z'
const LEAF1 = 'M0 -33C5 -54 28 -61 27 -48C26 -36 11 -31 0 -33Z'

/** Where a face rests: the body offset, the eye line, one altitude unit. */
export function frameOf(face: FaceGeom) {
  const baseY = FLOOR + face.sink - face.bottom
  const eyeY = face.eyes[0][1]
  // altitude -1 puts the eye line on the floor
  return { baseY, eyeY, R: FLOOR - (eyeY + baseY) }
}

/** The eyes' aim at the thing in the corner, from wherever they are. */
export function thingGaze(face: FaceGeom, x: number, alt: number): Gaze {
  const { baseY, eyeY, R } = frameOf(face)
  const ey = eyeY + baseY - alt * R
  return [
    clamp((THING[0] - 170 - x) / 150, -1, 1),
    clamp((THING[1] - ey) / 150, -1, 1),
  ]
}

/**
 * The pose an expression settles to. A curious face ends up looking at the
 * thing in the corner; an explicit gaze wins over both, unless the activity
 * locks the gaze.
 */
export function restPose(
  who: Pick<Axes, 'face'> & { key?: string },
  expression: Expression,
  gaze?: Gaze,
  activity: Activity = 'idle',
): Pose {
  const s = blend(expression, activity)
  const pose: Pose = {
    ...s,
    blink: 0,
    lag: 0,
    expression,
    activity,
    t: REST_T,
    wob: 0,
    fx: null,
    fxP: 0,
    voice: -1,
  }
  // the choreography's last key leaves curious leaning 7, not the table's 6
  if (expression === 'curious' && activity === 'idle') pose.rot = 7
  // idle adds no loop to the static pose, so v1 and v2 bytes hold
  if (activity !== 'idle') {
    const loop = activityLoop(activity, REST_T, loopPhase(who.key))
    for (const k in loop) {
      if (k === 'alt' || k === 'x') continue
      pose[k as Channel] += loop[k as Channel]!
    }
  }
  // an activity that locks the gaze drops a fixed gaze too, as Live does
  const lock = ACTIVITIES[activity].lockGaze
  const g =
    (lock ? undefined : gaze) ??
    (expression === 'curious' && !lock
      ? thingGaze(geomOf(who.face), 0, s.alt)
      : null)
  if (g) [pose.gx, pose.gy] = g
  return pose
}

/*
 * The ring is worn at one o'clock, 158 x 35deg along the crown from the top.
 * On a low or narrow crown that spot sits on the brow's outer end, so the
 * ring walks on down the outline until it clears the end at every height the
 * brow reaches (surprised, the widest persona, the heaviest brow), and rests
 * a little past that so it can still ride up, never back onto the brow.
 * Returns where it rests and how far up it may ride.
 */
const RING_U = 158 * 35 * RAD
export function ringWalk(sh: FaceGeom): { rest: number; min: number } {
  const ex = sh.eyes[1][0] + sh.brow.hw + 7
  const top = sh.brow.y - 30
  const bottom = sh.brow.y + 8
  let u = RING_U
  for (; u < 400; u += 2) {
    const s = seat(sh.crown, 8, u)
    const dx = s.x - ex
    const dy = s.y - clamp(s.y, top, bottom)
    if (s.x > ex ? Math.hypot(dx, dy) > 27 : s.y < top - 27) break
  }
  return u > RING_U ? { rest: u + 20, min: u } : { rest: u, min: -Infinity }
}

/*
 * Motif, shading and outline: what the theme paints over and around the
 * body. They are identity and theme level, never pose level, so a live tree
 * keeps the same nodes, and they sit in the body's group so they follow its
 * transform. The motif and shading are clipped to the body (`${id}-b`); the
 * outline rides on top, its glow behind. Patterns come from the 100-unit
 * mock, scaled by 3.4 into the frame.
 */
const U = 3.4
const WHITE = '#FFFFFF'
function skinOf(
  who: Drawable,
  sh: FaceGeom,
  slot: Ink,
  T: Theme,
  id: string,
  defs: Node[],
): { under: Node[]; over: Node[] } {
  const under: Node[] = []
  const over: Node[] = []
  const motif = who.motif
  const shading = T.shading
  const outline = T.outline
  if (motif === 'plain' && shading === 'flat' && !outline)
    return { under, over }

  const shapeOf = (key: string, attrs: Attrs) =>
    'd' in sh.body
      ? n('path', key, { d: sh.body.d, ...attrs })
      : n('circle', key, {
          cx: sh.body.circle[0],
          cy: sh.body.circle[1],
          r: sh.body.circle[2],
          ...attrs,
        })
  // a rounded body's own stroke widens its silhouette by half its width
  const rim = 'd' in sh.body ? (sh.body.stroke ?? 0) : 0
  // the body's vertical extent and half-width at the eye line
  const top = Math.min(...sh.crown.poly.map(([, y]) => y)) - sh.crown.r
  const bot = sh.bottom
  const h = bot - top
  const mid = (top + bot) / 2
  const side = sh.side
  const clip = `url(#${id}-b)`

  if (motif !== 'plain' || shading !== 'flat')
    defs.push(
      n('clipPath', 'body.clip', { id: `${id}-b` }, [
        shapeOf('body.clip.shape', {}),
        // a clip ignores strokes, so a rounded body's rim is covered by 16
        // copies nudged around a circle of the rim's half width
        ...(rim
          ? Array.from({ length: 16 }, (_, i) =>
              shapeOf(`body.clip.rim${i}`, {
                transform: `translate(${f2((rim / 2) * Math.cos(i * 22.5 * RAD))} ${f2((rim / 2) * Math.sin(i * 22.5 * RAD))})`,
              }),
            )
          : []),
      ]),
    )

  // the motif: one path each, so a pattern costs one node
  if (motif !== 'plain') {
    const ink = T.motifInk(slot)
    let d = ''
    let paint: Attrs = { fill: ink }
    let group: Attrs = { opacity: T.motifOpacity }
    if (motif === 'dots') {
      const s = 12 * U
      const r = 1.9 * U
      for (let j = 0; j * s <= 350; j++)
        for (let i = -1; i * s <= 350; i++) {
          const cx = i * s + (j % 2 ? s / 2 : 0)
          const cy = j * s
          d += `M${f2(cx - r)} ${f2(cy)}a${f2(r)} ${f2(r)} 0 1 0 ${f2(2 * r)} 0a${f2(r)} ${f2(r)} 0 1 0 ${f2(-2 * r)} 0`
        }
    } else if (motif === 'stripes') {
      const s = 10 * U
      for (let x = -170; x < 510; x += s)
        d += `M${f2(x)} -170h${f2(4 * U)}v680h${f2(-4 * U)}Z`
      paint = { ...paint, transform: 'rotate(45 170 170)' }
    } else if (motif === 'waves') {
      const s = 10 * U
      for (let y = s / 2; y < 360; y += s) {
        d += `M${f2(-s)} ${f2(y)}`
        for (let x = -s; x < 350; x += s)
          d += `q${f2(s / 2)} ${f2(-s / 2)} ${f2(s)} 0`
      }
      paint = {
        fill: 'none',
        stroke: ink,
        'stroke-width': f2(2 * U),
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }
    } else if (motif === 'grid') {
      const s = 12 * U
      for (let v = s / 2; v < 350; v += s)
        d += `M${f2(v)} -10V350M-10 ${f2(v)}H350`
      paint = { fill: 'none', stroke: ink, 'stroke-width': f2(1.2 * U) }
    } else if (motif === 'speckle') {
      const rnd = mulberry32(fnv1a(`${who.key ?? ''}sp`))
      for (let i = 0; i < 34; i++) {
        const cx = rnd() * 340
        const cy = top + rnd() * h
        const r = (0.9 + rnd() * 1.5) * U
        d += `M${f2(cx - r)} ${f2(cy)}a${f2(r)} ${f2(r)} 0 1 0 ${f2(2 * r)} 0a${f2(r)} ${f2(r)} 0 1 0 ${f2(-2 * r)} 0`
      }
    } else if (motif === 'glow') {
      group = { fill: WHITE }
    } else {
      // rays: 12 wedges of 12 degrees from the body's centre
      const R = 400
      for (let i = 0; i < 12; i++) {
        const a = i * 30 * RAD
        const p = (b: number) =>
          `${f2(170 + R * Math.sin(b))} ${f2(mid - R * Math.cos(b))}`
        d += `M170 ${f2(mid)}L${p(a - 6 * RAD)}L${p(a + 6 * RAD)}Z`
      }
      paint = { fill: WHITE }
      group = { opacity: 0.24 }
    }
    const kids =
      motif === 'glow'
        ? [
            n('ellipse', 'motif.shape', {
              cx: f2(170 - side * 0.4),
              cy: f2(top + h * 0.25),
              rx: f2(side * 0.36),
              ry: f2(h * 0.15),
              transform: `rotate(-24 ${f2(170 - side * 0.4)} ${f2(top + h * 0.25)})`,
              opacity: 0.32,
            }),
            n('ellipse', 'motif.shape2', {
              cx: f2(170 - side * 0.62),
              cy: f2(top + h * 0.45),
              rx: f2(side * 0.1),
              ry: f2(h * 0.06),
              opacity: 0.3,
            }),
          ]
        : [n('path', 'motif.shape', { d, ...paint })]
    over.push(n('g', 'motif', { 'clip-path': clip, ...group }, kids))
  }

  // shading, clipped like the motif
  if (shading === 'bold')
    over.push(
      n('g', 'shade', { 'clip-path': clip }, [
        n('ellipse', 'shade.bold', {
          cx: 170,
          cy: f2(bot + h * 0.1),
          rx: f2(Math.max(side * 1.5, 200)),
          ry: f2(h * 0.52),
          fill: '#000',
          opacity: 0.1,
        }),
      ]),
    )
  else if (shading === 'clay') {
    const hx = 170 - side * 0.38
    const hy = top + h * 0.27
    over.push(
      n('g', 'shade', { 'clip-path': clip }, [
        n('ellipse', 'shade.clay', {
          cx: f2(170 + side * 0.4),
          cy: f2(bot - h * 0.02),
          rx: f2(Math.max(side * 1.05, 120)),
          ry: f2(h * 0.55),
          fill: slot.deep,
          opacity: 0.45,
        }),
        n('ellipse', 'shade.clay.hi', {
          cx: f2(hx),
          cy: f2(hy),
          rx: f2(side * 0.34),
          ry: f2(h * 0.17),
          transform: `rotate(-28 ${f2(hx)} ${f2(hy)})`,
          fill: WHITE,
          opacity: 0.42,
        }),
        n('ellipse', 'shade.clay.spec', {
          cx: f2(hx - side * 0.12),
          cy: f2(hy - h * 0.05),
          rx: f2(side * 0.08),
          ry: f2(side * 0.05),
          transform: `rotate(-28 ${f2(hx - side * 0.12)} ${f2(hy - h * 0.05)})`,
          fill: WHITE,
          opacity: 0.7,
        }),
      ]),
    )
  }

  // the outline: on top of a plain body; a rounded body draws it behind,
  // grown past its own rim, since a stroke on top would land inside the rim
  if (outline) {
    const color = outline.color(slot)
    const w = outline.width
    const ring = (key: string, width: number, opacity?: number) =>
      shapeOf(key, {
        fill: 'none',
        stroke: color,
        'stroke-width': f2(width),
        'stroke-linejoin': 'round',
        opacity,
      })
    if (outline.glow) under.push(ring('outline.glow', rim + w * 3.5, 0.18))
    if (rim) under.push(ring('outline', rim + 2 * w))
    else over.push(ring('outline', w))
  }
  return { under, over }
}

export function draw(who: Drawable, pose: Pose, o: DrawOptions): Node {
  const sh: FaceGeom = geomOf(who.face)
  const T = o.theme ?? THEMES.soft
  const slot: Ink = o.ink ?? T.colors[who.color]
  const { body: fill, deep } = slot
  // bead, pill, dot and spark are one ink shape: a theme may colour them apart from the pupil
  const solidInk = T.solid ?? T.pupil
  const inkC = T.ink(slot)
  const frameFill =
    o.frame === 'theme'
      ? T.frame
      : o.frame === 'ink'
        ? INK.ink
        : o.frame === 'bone'
          ? INK.bone
          : INK.paper
  // a dark ground gets bone speckle and a bone lattice
  const dark = o.frame === 'theme' ? luma(T.frame) < 0.5 : o.frame === 'ink'
  const P = who.persona
  const mul = P.mul as Partial<Record<Channel, number>>
  const add = P.add as Partial<Record<Channel, number>>
  const g = (c: Channel) => pose[c] * (mul[c] ?? 1) + (add[c] ?? 0)
  const spread = P.spread
  const id = o.id
  const st = strokeFor(o.size)
  const { baseY, R } = frameOf(sh)
  const defs: Node[] = []
  const tier = tierOf(o.size, o.lod ?? false)
  const full = o.framing === 'full'
  // nothing to frame the body in: let a full body spill past the viewBox
  const spill = full && o.frame === 'none'

  // the frame
  const VBr = { x: VB[0], y: VB[1], width: VB[2], height: VB[3] }
  if (!spill)
    defs.push(
      n('clipPath', 'frame.clip', { id: `${id}-f` }, [
        o.square
          ? n('rect', 'frame.clip.shape', VBr)
          : n('circle', 'frame.clip.shape', { cx: 170, cy: 170, r: 200 }),
      ]),
    )

  // riso: registration error grows with size, nothing at 120px, about 1px
  // per plate at 480px and up; gentle edge wander plus mottled ink voids,
  // a different seed per plate
  const k = o.riso ? smooth(120, 480, o.size) : 0
  const riso = k > 0.01
  const upp = VB[2] / Math.max(o.size, 1)
  const mk = k * k
  const plate = (p: 'A' | 'B', seedA: number, seedB: number, sc: number) =>
    n(
      'filter',
      `riso.${p}`,
      {
        id: `${id}-p${p}`,
        x: '-20%',
        y: '-20%',
        width: '140%',
        height: '140%',
        'color-interpolation-filters': 'sRGB',
      },
      [
        n('feTurbulence', `riso.${p}.warp`, {
          type: 'fractalNoise',
          baseFrequency: '0.032',
          numOctaves: 2,
          seed: seedA,
          result: 'warp',
        }),
        n('feDisplacementMap', `riso.${p}.disp`, {
          in: 'SourceGraphic',
          in2: 'warp',
          scale: f2(sc * k),
          xChannelSelector: 'R',
          yChannelSelector: 'G',
          result: 'moved',
        }),
        n('feTurbulence', `riso.${p}.grain`, {
          type: 'fractalNoise',
          baseFrequency: '0.85',
          numOctaves: 2,
          seed: seedB,
          result: 'grain',
        }),
        n('feColorMatrix', `riso.${p}.mask`, {
          in: 'grain',
          type: 'matrix',
          values: `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${f3(-8 * mk)} 0 0 0 ${f3(1 + 5.85 * mk)}`,
          result: 'mask',
        }),
        n('feComposite', `riso.${p}.out`, {
          in: 'moved',
          in2: 'mask',
          operator: 'in',
        }),
      ],
    )
  const grainy = riso && o.frame !== 'none'
  if (riso) defs.push(plate('A', 4, 11, 3.2), plate('B', 9, 23, 2.2))
  if (grainy) {
    // bone speckle on ink, ink speckle on light grounds
    const [r, gg, b] = dark ? [0.953, 0.941, 0.91] : [0.102, 0.098, 0.094]
    defs.push(
      n(
        'filter',
        'grain.filter',
        {
          id: `${id}-grain`,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          'color-interpolation-filters': 'sRGB',
        },
        [
          n('feTurbulence', 'grain.noise', {
            type: 'fractalNoise',
            baseFrequency: '0.9',
            numOctaves: 2,
            seed: 5,
          }),
          n('feColorMatrix', 'grain.matrix', {
            type: 'matrix',
            values: `0 0 0 0 ${r}  0 0 0 0 ${gg}  0 0 0 0 ${b}  7 0 0 0 -5.1`,
          }),
        ],
      ),
    )
  }

  // colour drains a little when bored
  const dim = clamp(g('dim'), 0, 1)
  if (o.live || dim > 0.01)
    defs.push(
      n(
        'filter',
        'dim.filter',
        { id: `${id}-dim`, 'color-interpolation-filters': 'sRGB' },
        [
          n('feColorMatrix', 'dim.matrix', {
            type: 'saturate',
            values: f3(1 - dim * 0.55),
          }),
        ],
      ),
    )

  // the body
  const alt = g('alt')
  const rot = g('rot')
  const x = g('x')
  const sx = g('sx')
  const sy = g('sy')
  const B = sh.bottom
  const ty = baseY - alt * R
  const sc = (v: number) => Math.round(v * 100000) / 100000
  const bodyTransform = `translate(${f2(x)} ${f2(ty)}) rotate(${f2(rot)} 170 ${B}) translate(170 ${B}) scale(${sc(sx)} ${sc(sy)}) translate(-170 ${-B})`
  const bodyNode =
    'd' in sh.body
      ? n('path', 'body', {
          d: sh.body.d,
          fill,
          stroke: sh.body.stroke ? fill : undefined,
          'stroke-width': sh.body.stroke,
          'stroke-linejoin': sh.body.stroke ? 'round' : undefined,
        })
      : n('circle', 'body', {
          cx: sh.body.circle[0],
          cy: sh.body.circle[1],
          r: sh.body.circle[2],
          fill,
        })
  const skin = skinOf(
    tier === 0 ? { ...who, motif: 'plain' } : who,
    sh,
    slot,
    T,
    id,
    defs,
  )

  // eyes
  const eyeS = g('eyeS')
  const rx = sh.rx * eyeS
  const ry = sh.ry * eyeS
  const lid0 = g('lid')
  const lidAsym = g('lidAsym')
  const winkR = pose.winkR ?? 0
  const lower = clamp(g('lower'), 0, 1)
  const blink = pose.blink
  const pupil = g('pupil')
  const gx = clamp(g('gx'), -1.1, 1.1)
  const gy = clamp(g('gy'), -1.1, 1.1)
  const tilt = g('lidTilt')
  const shine = clamp(g('shine'), 0, 1)
  const sw = sh.brow.w * st
  const bead = who.eyes === 'bead'
  // a solid eye is one ink shape, no white: pill, dot or spark. Like a bead
  // it leans whole toward its gaze, and its lids cut it the same way.
  const solid =
    who.eyes === 'pill' || who.eyes === 'dot' || who.eyes === 'spark'
  // the visor stands in for the eyes: it glows where they would look
  const eyes = (who.eyewear === 'visor' ? [] : sh.eyes).map(([ex, ey], i) => {
    const side = i === 0 ? -1 : 1
    const kk = `eye${i}`
    let lid = clamp(lid0 + (i === 0 ? lidAsym : -lidAsym * 0.3), 0, 1)
    // a wink closes the right eye over whatever lid it already shows
    if (i === 1) lid = Math.max(lid, clamp(winkR, 0, 1))
    lid = lid + (1 - lid) * blink
    defs.push(
      n('clipPath', `${kk}.clip`, { id: `${id}-e${i}` }, [
        n('ellipse', `${kk}.clip.shape`, {
          cx: 0,
          cy: 0,
          rx: f2(rx),
          ry: f2(ry),
        }),
      ]),
      n('clipPath', `${kk}.lidclip`, { id: `${id}-l${i}` }, [
        n('ellipse', `${kk}.lidclip.shape`, {
          cx: 0,
          cy: 0,
          rx: f2(rx + 1.6),
          ry: f2(ry + 1.6),
        }),
      ]),
    )
    // what sits in the socket: a pupil on paper, a bare bead, or a rimmed eye
    const br = Math.min(sh.rx, sh.ry) * 0.62
    const pr = bead ? br * eyeS * (0.4 + 0.6 * pupil) : sh.pr * pupil
    const base = bead ? br : sh.pr
    const px = gx * Math.max(0, sh.rx - base) * 0.9
    const py = gy * Math.max(0, sh.ry - base) * 0.8
    // capped so a small rimmed eye stays an eye, not an ink blot
    const rimW = Math.min(sw * 0.8, Math.min(sh.rx, sh.ry) * 0.28)
    const inner: Node[] = []
    // a smiling solid eye trades its shape for an upturned arc
    const happy = solid
      ? smooth(0.22, 0.36, lower) * (1 - smooth(0.2, 0.3, lid))
      : 0
    if (solid) {
      const pk = 0.4 + 0.6 * pupil
      const shapes: Node[] = []
      if (who.eyes === 'pill') {
        const w = rx * 0.42 * pk
        const h = Math.max(w, ry * 0.9 * pk)
        shapes.push(
          n('rect', `${kk}.solid.shape`, {
            x: f2(-w),
            y: f2(-h),
            width: f2(2 * w),
            height: f2(2 * h),
            rx: f2(w),
            fill: solidInk(slot),
          }),
        )
      } else if (who.eyes === 'dot') {
        shapes.push(
          n('circle', `${kk}.solid.shape`, {
            cx: 0,
            cy: 0,
            r: f2(rx * 0.42 * pk),
            fill: solidInk(slot),
          }),
        )
      } else {
        const erx = rx * 0.48 * pk
        const ery = ry * 0.72 * pk
        shapes.push(
          n('ellipse', `${kk}.solid.shape`, {
            cx: 0,
            cy: 0,
            rx: f2(erx),
            ry: f2(ery),
            fill: solidInk(slot),
          }),
          n('circle', `${kk}.shine`, {
            cx: f2(erx * 0.38),
            cy: f2(-ery * 0.42),
            r: f2(rx * 0.2 * pk),
            fill: INK.paper,
            opacity: f2(shine),
          }),
          n('circle', `${kk}.shine2`, {
            cx: f2(-erx * 0.4),
            cy: f2(ery * 0.45),
            r: f2(rx * 0.09 * pk),
            fill: INK.paper,
            opacity: f2(shine),
          }),
        )
      }
      inner.push(
        n(
          'g',
          `${kk}.solid`,
          { opacity: happy > 0.01 ? f2(1 - happy) : undefined },
          shapes,
        ),
      )
    }
    if (!bead && !solid)
      inner.push(
        n('ellipse', `${kk}.white`, {
          cx: 0,
          cy: 0,
          rx: f2(rx),
          ry: f2(ry),
          fill: T.sclera(slot),
        }),
      )
    if (!solid)
      inner.push(
        n('circle', `${kk}.pupil`, {
          cx: f2(px),
          cy: f2(py),
          r: f2(pr),
          fill: bead ? solidInk(slot) : T.pupil(slot),
        }),
        n('circle', `${kk}.shine`, {
          cx: f2(px + pr * 0.44),
          cy: f2(py - pr * 0.44),
          r: f2(pr * (bead ? 0.26 : 0.3)),
          fill: INK.paper,
          opacity: f2(shine),
        }),
      )
    if (who.eyes === 'ring')
      inner.push(
        n('ellipse', `${kk}.rim`, {
          cx: 0,
          cy: 0,
          rx: f2(rx - rimW / 2),
          ry: f2(ry - rimW / 2),
          fill: 'none',
          stroke: inkC,
          'stroke-width': f2(rimW),
        }),
      )
    // upper lid: a straight cut, tilted, same as the v1.0 sad and angry lids
    const edge = -ry - 1.6 + lid * (2 * ry + 3.2)
    const a = side * tilt
    // lower lid: a wide arc pushing up from below, the smiling squint
    const lrx = rx * 1.55
    const lry = ry * 1.15
    const top = ry + 1.6 - lower * ry * 1.5
    const parts: Node[] = [
      n('g', `${kk}.inner`, { 'clip-path': `url(#${id}-e${i})` }, inner),
      n('g', `${kk}.lids`, { 'clip-path': `url(#${id}-l${i})` }, [
        n('rect', `${kk}.lid`, {
          x: f2(-rx * 2.2),
          y: f2(-ry * 3),
          width: f2(rx * 4.4),
          height: f2(Math.max(0, edge + ry * 3)),
          transform: `rotate(${f2(a)})`,
          fill,
        }),
        n('ellipse', `${kk}.lower`, {
          cx: 0,
          cy: f2(top + lry),
          rx: f2(lrx),
          ry: f2(lry),
          fill,
        }),
      ]),
    ]
    // a rimmed eye inks its lid edges too, so the outline follows the lids
    if (who.eyes === 'ring')
      parts.push(
        n(
          'g',
          `${kk}.edges`,
          {
            'clip-path': `url(#${id}-e${i})`,
            fill: 'none',
            stroke: inkC,
            'stroke-width': f2(rimW),
          },
          [
            n('path', `${kk}.edge`, {
              d: `M${f2(-rx * 2.2)} ${f2(edge)}H${f2(rx * 2.2)}`,
              transform: `rotate(${f2(a)})`,
              opacity: lid > 0.02 ? 1 : 0,
            }),
            n('ellipse', `${kk}.edge.lower`, {
              cx: 0,
              cy: f2(top + lry),
              rx: f2(lrx),
              ry: f2(lry),
              opacity: lower > 0.02 ? 1 : 0,
            }),
          ],
        ),
      )
    // closed eye: a hairline drawn once the lid is down
    const co = smooth(0.86, 1, lid)
    const yy = Math.min(edge, ry) - 1
    const hw = rx * 0.92
    parts.push(
      n('path', `${kk}.closed`, {
        d: `M${f2(-hw)} ${f2(yy - 2)}Q0 ${f2(yy + 6)} ${f2(hw)} ${f2(yy - 2)}`,
        transform: `rotate(${f2(a * 0.6)})`,
        fill: 'none',
        stroke: inkC,
        'stroke-linecap': 'round',
        'stroke-width': f2(sw * 0.85),
        opacity: co > 0.01 ? f2(co) : 0,
      }),
    )
    if (solid) {
      // the smiling solid eye: an arc bowed upward, the width of the eye
      const aw = rx * 0.62
      const ay = ry * 0.22
      parts.push(
        n('path', `${kk}.happy`, {
          d: `M${f2(-aw)} ${f2(ay)}Q0 ${f2(ay - ry * 1.1)} ${f2(aw)} ${f2(ay)}`,
          fill: 'none',
          stroke: inkC,
          'stroke-linecap': 'round',
          'stroke-width': f2(sw * 1.25),
          opacity: happy > 0.01 ? f2(happy) : 0,
        }),
      )
    }
    return n(
      'g',
      kk,
      {
        // a bead has no white to show where it looks, so the whole eye leans
        transform: bead
          ? `translate(${f2(ex + side * spread + gx * 6)} ${f2(ey + gy * 6)})`
          : solid
            ? `translate(${f2(ex + side * spread + gx * rx * 0.3)} ${f2(ey + gy * ry * 0.3)})`
            : `translate(${f2(ex + side * spread)} ${ey})`,
      },
      parts,
    )
  })

  // brows
  const browY = g('browY') - (eyeS - 1) * sh.ry * 0.9
  const btilt = g('browTilt')
  const arch = g('browArch')
  const basym = g('browAsym')
  const bw = sw * g('browW')
  // `none` parts leave no node at all: the identity decides, never the pose
  const brows = (who.brows === 'none' ? [] : sh.eyes).map(([ex], i) => {
    const side = i === 0 ? -1 : 1
    const hw = sh.brow.hw
    const c = -sh.brow.arch * arch
    // half-length, arch depth and stroke weight per type
    const [w, ca, k2] =
      who.brows === 'bar'
        ? [hw * 0.9, c * 0.3, 1.75]
        : who.brows === 'dash'
          ? [hw * 0.42, c * 0.25, 1.9]
          : [hw, c, 1]
    // wedge: tapered, heavy at the inner end, toward the nose
    const ti = bw * 1.7
    const to = bw * 0.45
    const [tl, tr] = side < 0 ? [to, ti] : [ti, to]
    const wedge = who.brows === 'wedge'
    const [hl, hr] = wedge ? [tl / 2 + to / 2, tr / 2 + to / 2] : [0, 0]
    const half = (t: number) => (wedge ? hl + (hr - hl) * t : (bw * k2) / 2)
    // a brow never leaves the face: raised into the outline, it stops there
    const bx = ex + side * spread
    const by = sh.brow.y + browY + (i === 1 ? -basym : basym * 0.3)
    const cos = Math.cos(side * btilt * RAD)
    const sin = Math.sin(side * btilt * RAD)
    const inside = (dy: number) => {
      for (let t = 0; t <= 1; t += 0.25) {
        const lx = w * (2 * t - 1)
        const ly = 2 * t * (1 - t) * ca
        const px = bx + lx * cos - ly * sin
        const py = by + dy + lx * sin + ly * cos
        if (depth(sh.crown, px, py) + half(t) + 2 > 0) return false
      }
      return true
    }
    let lo = 0
    let hi = 0
    if (!inside(0)) {
      hi = 40
      for (let k = 0; k < 12; k++) {
        const mid = (lo + hi) / 2
        if (inside(mid)) hi = mid
        else lo = mid
      }
    }
    const transform = `translate(${f2(bx)} ${f2(by + hi)}) rotate(${f2(side * btilt)})`
    const key = `brow${i}`
    if (wedge) {
      const dm = ((tl + tr) / 2) * 0.75
      return n('path', key, {
        d: `M${f2(-hw)} ${f2(-tl / 2)}Q0 ${f2(c - dm)} ${f2(hw)} ${f2(-tr / 2)}L${f2(hw)} ${f2(tr / 2)}Q0 ${f2(c + dm)} ${f2(-hw)} ${f2(tl / 2)}Z`,
        transform,
        fill: inkC,
        stroke: inkC,
        'stroke-linejoin': 'round',
        'stroke-width': f2(to),
      })
    }
    return n('path', key, {
      d: `M${f2(-w)} 0Q0 ${f2(ca)} ${f2(w)} 0`,
      transform,
      fill: 'none',
      stroke: inkC,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'stroke-width': f2(bw * k2),
    })
  })

  // mouth
  const m = sh.mouth
  const mw = m.w * Math.max(0.05, g('mw'))
  const mt = g('mt') * m.d
  const mb = g('mb') * m.d
  const kb = 4 / 3
  const w7 = mw * 0.72
  // line: one open stroke along the middle of the lips, so it stays a line
  // in every state: a smile, a frown, or flat where the others open
  const mid = ((mt + mb) / 2) * kb
  const d =
    who.mouth === 'poly'
      ? `M${f2(-mw)} 0L0 ${f2(mt)}L${f2(mw)} 0L0 ${f2(mb)}Z`
      : who.mouth === 'box'
        ? `M${f2(-mw)} 0L${f2(-w7)} ${f2(mb)}L${f2(w7)} ${f2(mb)}L${f2(mw)} 0L${f2(w7)} ${f2(mt)}L${f2(-w7)} ${f2(mt)}Z`
        : who.mouth === 'line'
          ? `M${f2(-mw)} 0C${f2(-mw * 0.5)} ${f2(mid)} ${f2(mw * 0.5)} ${f2(mid)} ${f2(mw)} 0`
          : `M${f2(-mw)} 0C${f2(-mw)} ${f2(mb * kb)} ${f2(mw)} ${f2(mb * kb)} ${f2(mw)} 0C${f2(mw)} ${f2(mt * kb)} ${f2(-mw)} ${f2(mt * kb)} ${f2(-mw)} 0Z`
  const open = who.mouth === 'line'
  const mouthT = `translate(${f2(m.x + g('mx'))} ${f2(m.y + g('my'))}) rotate(${f2(g('mk'))})`
  const mouths: Node[] = []
  if (who.mouth === 'cat') {
    // two small bows meeting in the middle; the lips' middle sets how they
    // curl, and a gap between the lips drops a little mouth under them
    const k = clamp(mid * 0.7, -m.d, m.d)
    const gap = Math.max(0, mb - mt)
    const op = smooth(m.d * 0.55, m.d * 0.9, gap)
    const ory = gap * 0.42 * (0.5 + 0.5 * op)
    mouths.push(
      n('g', 'mouth', { transform: mouthT }, [
        n('ellipse', 'mouth.open', {
          cx: 0,
          cy: f2(Math.max(0, k * 0.5) + ory * 0.8),
          rx: f2(Math.max(3, mw * 0.6)),
          ry: f2(Math.max(1, ory)),
          fill: inkC,
          opacity: op > 0.01 ? f2(op) : 0,
        }),
        n('path', 'mouth.line', {
          d: `M${f2(-mw)} 0Q${f2(-mw / 2)} ${f2(k)} 0 0Q${f2(mw / 2)} ${f2(k)} ${f2(mw)} 0`,
          fill: 'none',
          stroke: inkC,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-width': f2(sw),
        }),
      ]),
    )
  } else if (who.mouth !== 'none')
    mouths.push(
      n('path', 'mouth', {
        d,
        transform: mouthT,
        fill: open ? 'none' : inkC,
        stroke: inkC,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': f2(open ? sw : m.sw * st),
      }),
    )

  // cheeks
  const blush = clamp(g('blush'), 0, 1)
  const cheeks = (who.cheeks === 'none' ? [] : sh.cheeks).map(([cx, cy], i) => {
    const key = `cheek${i}`
    const at = {
      opacity: f2(blush),
      transform: `translate(${f2(cx + (i === 0 ? -1 : 1) * spread * 0.6)} ${f2(cy - lower * 4)}) scale(${f2(0.6 + 0.4 * blush)}) translate(${-cx} ${-cy})`,
    }
    if (who.cheeks === 'dots') {
      const r = sh.cry * 0.9
      return n('g', key, { ...at, fill: deep }, [
        n('circle', `${key}.0`, { cx: f2(cx - sh.crx * 1.05), cy, r: f2(r) }),
        n('circle', `${key}.1`, { cx, cy: f2(cy + sh.cry * 0.5), r: f2(r) }),
        n('circle', `${key}.2`, { cx: f2(cx + sh.crx * 1.05), cy, r: f2(r) }),
      ])
    }
    if (who.cheeks === 'lines') {
      const h = sh.cry * 1.3
      return n(
        'g',
        key,
        {
          ...at,
          fill: 'none',
          stroke: deep,
          'stroke-linecap': 'round',
          'stroke-width': f2(sh.cry * 0.78),
        },
        [-1, 0, 1].map((j) => {
          const x0 = cx + j * sh.crx * 0.8
          return n('path', `${key}.${j + 1}`, {
            d: `M${f2(x0 + h * 0.5)} ${f2(cy - h)}L${f2(x0 - h * 0.5)} ${f2(cy + h)}`,
          })
        }),
      )
    }
    return n('ellipse', key, {
      cx,
      cy,
      rx: sh.crx,
      ry: sh.cry,
      fill: deep,
      ...at,
    })
  })

  // signature trait: each one keeps its v1.2 motion, measured from a seat on
  // the crown outline instead of a spot on its old face
  const hair = g('hair')
  const lag = pose.lag
  // the swing: the trait takes 0.6 of it on top of its own lag
  const tw = 0.6 * pose.wob
  let traitT = ''
  let shape: Node | null = null
  if (who.trait === 'none') {
    // no crest
  } else if (who.trait === 'square') {
    const s = seat(sh.crown, 22 + hair * 10, 0)
    traitT = `translate(${f2(s.x)} ${f2(s.y + lag)}) rotate(${f2(s.a + 22 + hair * 23 + tw)})`
    shape = n('rect', 'trait.shape', {
      x: -11,
      y: -11,
      width: 22,
      height: 22,
      fill: deep,
    })
  } else if (who.trait === 'fin') {
    const s = seat(sh.crown, -6, -164 * 22 * RAD)
    const r = s.a + (hair >= 0 ? hair * 20 : hair * 55) - lag * 0.8 + tw
    traitT = `translate(${f2(s.x)} ${f2(s.y + lag * 0.25)}) rotate(${f2(r)})`
    shape = n('path', 'trait.shape', {
      d: 'M0 0L0 -40A40 40 0 0 1 40 0Z',
      fill: deep,
    })
  } else if (who.trait === 'ring') {
    // worn at one o'clock; rides up when excited, slides when sleepy
    const b = 35 - hair * 14 - (hair < 0 ? hair * -21 : 0) + lag * 0.9
    const w = ringWalk(sh)
    const s = seat(sh.crown, 8, Math.max(w.min, w.rest + 158 * (b - 35) * RAD))
    traitT = `translate(${f2(s.x)} ${f2(s.y)}) scale(${f2(1 + Math.max(0, hair) * 0.1)})`
    shape = n('circle', 'trait.shape', {
      cx: 0,
      cy: 0,
      r: 12.5,
      fill: 'none',
      stroke: deep,
      'stroke-width': f2(7 * (pose.expression === 'angry' ? 1.25 : 1)),
    })
  } else if (who.trait === 'dot') {
    // rests on the top; lifts clear when perky, rolls over and down the
    // right slope when low
    const s = clamp(-hair, 0, 1.2)
    const th = Math.min(1, s / 0.35) * 61.05 * RAD
    const travel = (Math.max(0, s - 0.35) / 0.65) * 92
    const p = seat(sh.crown, 12.5, 26.1 * th + travel)
    let cy = p.y
    if (hair > 0) cy -= hair * 18
    cy += lag * (s > 0.35 ? 0.3 : 1)
    traitT = `translate(${f2(p.x)} ${f2(cy)}) scale(${f2(1 + Math.max(0, hair) * 0.1)})`
    shape = n('circle', 'trait.shape', { cx: 0, cy: 0, r: 12.5, fill: deep })
  } else {
    // peak: the mark's triangle worn on the crown; lifts when perky, keels
    // over sideways when low
    const s = seat(sh.crown, 4 + Math.max(0, hair) * 9, 0)
    const r = s.a + (hair < 0 ? -hair * 38 : 0) - lag * 0.5 + tw
    traitT = `translate(${f2(s.x)} ${f2(s.y + lag)}) rotate(${f2(r)}) scale(${f2(1 + Math.max(0, hair) * 0.1)})`
    shape = n('path', 'trait.shape', {
      d: 'M0 -27L13 -3L-13 -3Z',
      fill: deep,
      stroke: deep,
      'stroke-width': 6,
      'stroke-linejoin': 'round',
    })
  }
  const trait = shape ? [n('g', 'trait', { transform: traitT }, [shape])] : []

  // Wardrobe lives on the same body transform as the face. Glasses grow
  // around the eye sockets, never around the pupils, so gaze stays free.
  const wardrobe: Node[] = []
  // strokes follow the same ramp as the face, capped so small hats stay hats
  const w = (px: number) => f2(px * Math.min(st, 1.6))
  // ink lines follow the theme's ink; soft's is INK.ink, so peek@1 holds
  const line = {
    fill: 'none',
    stroke: inkC,
    'stroke-width': w(5.25),
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }
  // everything past Peek's own items: one drawing per slot from the
  // registry, painted after that slot's Peek item
  const ctx: WearCtx = {
    sh,
    who,
    pose,
    t: pose.t + loopPhase(who.key),
    theme: T,
    ink: slot,
    g,
    stroke: st,
    id,
    size: o.size,
  }
  const wearOf = (kind: WearSlot, name: string) => {
    if (Object.hasOwn(WEAR[kind], name)) return WEAR[kind][name]!.draw(ctx)
    // a registered plugin, after the built-ins: never shadows one
    const plug = accessoryOf(kind, name)
    return plug ? [drawPlugin(plug, ctx)] : []
  }
  const wear = (kind: WearSlot, name: string) => {
    wardrobe.push(...wearOf(kind, name))
  }
  // the face decoration paints over the cheeks and the mouth, under eyewear
  const decor = wearOf('decor', who.decor)
  if (who.eyewear === 'glasses' || who.eyewear === 'sunglasses') {
    const lx = sh.eyes[0][0] - spread
    const rr = sh.eyes[1][0] + spread
    const ey = sh.eyes[0][1]
    const gap = rr - lx
    const erx = Math.min(rx + 9, (gap - 15) / 2)
    const ery = ry + 9
    const glasses = who.eyewear === 'glasses'
    const lensX = glasses ? erx : Math.min(rx + 11, (gap - 12) / 2)
    const top = glasses ? ey - 4 : ey - ry - 2
    const frames: Node[] = [
      n('path', 'eyewear.bridge', {
        ...line,
        d: `M${f2(lx + lensX)} ${f2(top)}Q${f2((lx + rr) / 2)} ${f2(top - (glasses ? 13 : 0))} ${f2(rr - lensX)} ${f2(top)}`,
      }),
    ]
    for (const [i, cx] of [lx, rr].entries()) {
      const key = `eyewear.lens${i}`
      frames.push(
        n('path', `${key}.arm`, {
          ...line,
          d:
            i === 0
              ? `M${f2(cx - lensX - 9)} ${f2(top + 2)}L${f2(cx - lensX)} ${f2(top)}`
              : `M${f2(cx + lensX)} ${f2(top)}L${f2(cx + lensX + 9)} ${f2(top + 2)}`,
        }),
      )
      if (glasses) {
        frames.push(
          n('ellipse', key, {
            ...line,
            cx: f2(cx),
            cy: ey,
            rx: f2(erx),
            ry: f2(ery),
          }),
        )
        frames.push(
          n('path', `${key}.glint`, {
            ...line,
            stroke: INK.paper,
            'stroke-width': w(3),
            d: `M${f2(cx - erx * 0.65)} ${f2(ey - ery * 0.45)}Q${f2(cx - erx * 0.5)} ${f2(ey - ery * 0.8)} ${f2(cx - erx * 0.2)} ${f2(ey - ery * 0.86)}`,
          }),
        )
      } else {
        const h = ry * 2 + 9
        frames.push(
          n('path', key, {
            d: `M${f2(cx - lensX)} ${f2(top)}H${f2(cx + lensX)}V${f2(top + h * 0.55)}Q${f2(cx + lensX)} ${f2(top + h)} ${f2(cx)} ${f2(top + h)}Q${f2(cx - lensX)} ${f2(top + h)} ${f2(cx - lensX)} ${f2(top + h * 0.55)}Z`,
            fill: inkC,
            stroke: inkC,
            'stroke-width': w(3),
            'stroke-linejoin': 'round',
          }),
        )
        frames.push(
          n('path', `${key}.glint`, {
            ...line,
            stroke: INK.paper,
            'stroke-width': w(4),
            d: `M${f2(cx - lensX * 0.58)} ${f2(top + 19)}l8 -8m-1 15 6 -6`,
          }),
          n('circle', `${key}.pin`, {
            cx: f2(cx + lensX * 0.55),
            cy: f2(top + h - 9),
            r: 1.7,
            fill: INK.paper,
          }),
        )
      }
    }
    wardrobe.push(n('g', 'eyewear', {}, frames))
  }
  wear('eyewear', who.eyewear)
  if (
    who.headwear === 'bow' ||
    who.headwear === 'cap' ||
    who.headwear === 'sprout'
  ) {
    // Reserve the side opposite the crest. The seat stays fixed through
    // expressions, so a moving crest never makes a hat switch sides.
    const side = who.trait === 'ring' || who.trait === 'dot' ? -1 : 1
    const cap = who.headwear === 'cap'
    const sprout = who.headwear === 'sprout'
    // The sheet measures placement across the crown, not along its arc.
    // Solve that horizontal offset so low, round faces keep the brim above
    // their brows instead of walking the hat down the side of the body.
    const inset = sprout ? -6 : cap ? -8 : 0
    const offset = sprout ? 34 : 40
    let lo = 0
    let hi = 160
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2
      const p = seat(sh.crown, inset, side * mid)
      if (side * (p.x - 170) < offset) lo = mid
      else hi = mid
    }
    const anchor = seat(sh.crown, inset, (side * (lo + hi)) / 2)
    const angle = clamp(anchor.a, -40, 40)
    const parts: Node[] = []
    if (cap) {
      parts.push(
        n('path', 'headwear.crown', {
          ...line,
          fill: INK.paper,
          d: 'M-33 0C-35 -20 -20 -39 0 -39C20 -39 35 -20 33 0Z',
        }),
        n('path', 'headwear.seam', {
          ...line,
          'stroke-width': w(3.5),
          d: 'M-4 -38Q9 -24 8 -1',
        }),
        n('path', 'headwear.brim', {
          ...line,
          'stroke-width': w(7),
          d: side > 0 ? 'M-35 1Q8 4 52 3' : 'M-52 3Q-8 4 35 1',
        }),
        n('circle', 'headwear.button', {
          cx: 0,
          cy: -40,
          r: 3.5,
          fill: inkC,
        }),
      )
    } else if (sprout) {
      parts.push(
        // a body-colored halo keeps the ink stem off an ink ground
        n('path', 'headwear.halo', {
          ...line,
          stroke: fill,
          'stroke-width': w(11),
          d: `${STEM}${LEAF0}${LEAF1}`,
        }),
        n('path', 'headwear.stem', {
          ...line,
          'stroke-width': w(4.5),
          d: STEM,
        }),
        n('path', 'headwear.leaf0', {
          ...line,
          'stroke-width': w(4),
          fill: COLORS.mint.body,
          d: LEAF0,
        }),
        n('path', 'headwear.leaf1', {
          ...line,
          'stroke-width': w(4),
          fill: COLORS.mint.deep,
          d: LEAF1,
        }),
      )
    } else {
      parts.push(
        n('path', 'headwear.wings', {
          d: 'M-3 0C-13 -16 -28 -23 -29 -10C-31 2 -26 19 -16 13L-3 4L3 4L16 13C26 19 31 2 29 -10C28 -23 13 -16 3 0Z',
          fill: inkC,
          // the same halo, painted under the fill
          stroke: fill,
          'stroke-width': w(6),
          'stroke-linejoin': 'round',
          'paint-order': 'stroke',
        }),
        n('ellipse', 'headwear.knot', {
          cx: 0,
          cy: 1,
          rx: 6,
          ry: 8,
          fill: ACCESSORY_INK.knot,
        }),
      )
    }
    wardrobe.push(
      n(
        'g',
        'headwear',
        {
          transform: `translate(${f2(anchor.x)} ${f2(anchor.y)}) rotate(${f2(sprout ? angle * 0.5 + pose.wob : angle)})`,
        },
        parts,
      ),
    )
  }
  wear('headwear', who.headwear)
  if (who.neckwear === 'tie') {
    // The knot follows the mouth's lowest edge, including its skew. The
    // floor clips the blade, just as it clips the creature itself.
    const skew = Math.abs(Math.sin(g('mk') * RAD)) * mw
    const bottom = Math.max(0, mt * kb, mb * kb) + skew + m.sw * st
    wardrobe.push(
      n(
        'g',
        'neckwear',
        {
          transform: `translate(${m.x} ${f2(m.y + g('my') + bottom + 8)})`,
          fill: inkC,
        },
        [
          n('path', 'neckwear.knot', {
            d: 'M-9 0Q-11 0 -9 4L-5 11Q0 15 5 11L9 4Q11 0 9 0Z',
          }),
          n('path', 'neckwear.blade', {
            d: 'M-4 15L-13 63Q-14 66 -11 69L0 79L11 69Q14 66 13 63L4 15Z',
          }),
        ],
      ),
    )
  }
  wear('neckwear', who.neckwear)

  // the plates sit a hair out of register at large sizes
  const off = (dx: number, dy: number) =>
    riso ? `translate(${f2(dx * k * upp)} ${f2(dy * k * upp)})` : undefined
  const av = n(
    'g',
    'av',
    {
      transform: bodyTransform,
      filter: dim > 0.01 ? `url(#${id}-dim)` : undefined,
    },
    [
      n(
        'g',
        'plateA',
        {
          transform: off(-0.55, 0.45),
          filter: riso ? `url(#${id}-pA)` : undefined,
        },
        [
          ...skin.under,
          bodyNode,
          ...skin.over,
          ...(tier >= 2 ? [...cheeks, ...trait] : []),
        ],
      ),
      n(
        'g',
        'plateB',
        {
          transform: off(0.6, -0.5),
          filter: riso ? `url(#${id}-pB)` : undefined,
        },
        // the LOD gate: wardrobe from tier 1 (the prop, from tier 2, is
        // drawn in frame space after the body)
        [
          ...eyes,
          ...(tier >= 2 ? brows : []),
          ...(tier >= 1 ? [...mouths, ...decor, ...wardrobe] : []),
        ],
      ),
    ],
  )

  // The fx layer: the activity's overlays, then the reaction's, poured into
  // a fixed pool of paths (FX_POOL, or FX_POOL_SMALL below tier 2) so a live
  // tree keeps its nodes whatever is shown. Frame space, anchored on the body's offset but not its tilt or
  // squash, so a bubble does not lean with the head. Below 44px only the ask
  // badge stays, grown to read.
  const top = Math.min(...sh.crown.poly.map(([, y]) => y)) - sh.crown.r
  const kinds: string[] = []
  // built-in kinds first, then a registered fx plugin of that name
  const drawable = (k: string) =>
    (FX_KINDS as string[]).includes(k) || fxOf(k) !== undefined
  if (o.fx !== false) {
    kinds.push(...(ACTIVITIES[pose.activity]?.fx ?? []))
    if (pose.fx && drawable(pose.fx)) kinds.push(pose.fx)
    if (typeof o.fx === 'string' && drawable(o.fx)) kinds.push(o.fx)
  }
  const anchor = {
    headX: 170 + x,
    headTop: top + ty,
    side: sh.side,
    eyeY: sh.eyes[0][1] + ty,
    mouthY: sh.mouth.y + g('my') + ty,
  }
  const shapes = kinds
    .filter((kind) => tier >= 2 || kind === 'ask')
    .flatMap((kind) => {
      const plug = (FX_KINDS as string[]).includes(kind)
        ? undefined
        : fxOf(kind)
      return plug
        ? fxPluginShapes(plug, pose.t, pose.fxP, anchor)
        : fxShapes(
            kind as FxKind,
            pose.t,
            pose.fxP,
            anchor,
            inkC,
            dark,
            tier < 2 ? 1.8 : 1,
          )
    })
  // the tier follows the size, which never changes on a live avatar, so the
  // node set holds: below tier 2 three nodes are enough for the ask badge
  const poolSize = tier >= 2 ? FX_POOL : FX_POOL_SMALL
  const pool: Node[] = []
  for (let i = 0; i < poolSize; i++) {
    const s = shapes[i]
    pool.push(
      s
        ? n('path', `fx.${i}`, {
            d: s.d,
            fill: s.fill,
            stroke: s.stroke === 'none' ? undefined : s.stroke,
            'stroke-width': s.strokeWidth ? f2(s.strokeWidth) : undefined,
            'stroke-linecap': s.strokeWidth ? 'round' : undefined,
            'stroke-linejoin': s.strokeWidth ? 'round' : undefined,
            opacity: s.opacity < 1 ? f3(s.opacity) : undefined,
            transform: s.transform || undefined,
          })
        : n('path', `fx.${i}`, { d: 'M0 0', opacity: 0 }),
    )
  }
  const fxLayer = n('g', 'fx', {}, pool)

  // The held prop: frame space, after the body and under the fx, so a
  // sparkle or a zzz still reads over it. Hidden below 44px (tier 2). With
  // no prop there is no layer at all, so peek@1's live tree holds; with one,
  // the layer is there at every size and a static tree prunes it when empty.
  // It sits beside the body inside the visible frame; under full framing the
  // frame maps back through the framing transform into the group's space.
  const builtInProp = !!who.prop && Object.hasOwn(HELD_PROPS, who.prop)
  const propPlug = builtInProp ? undefined : propOf(who.prop)
  const holds = builtInProp || propPlug !== undefined
  const fullC = (top - HEADROOM + sh.bottom) / 2 + baseY
  const toLocal = (v: number, c: number) =>
    full ? (v - 170) / FULL_SCALE + c : v
  // the visible frame (the viewBox), or the round frame's clip circle,
  // mapped into the prop's space
  const bound: PropBound = {
    box: [
      toLocal(VB[0], 170),
      toLocal(VB[1], fullC),
      toLocal(VB[0] + VB[2], 170),
      toLocal(VB[1] + VB[3], fullC),
    ],
    circle: o.square
      ? undefined
      : [170, full ? fullC : 170, full ? 200 / FULL_SCALE : 200],
    scale: full ? FULL_SCALE : 1,
  }
  const propNodes = () => {
    const propCtx = {
      ...ctx,
      propAt: swayed(
        propSpot(sh, baseY, spread, bound, 0.4 * R),
        x,
        ty - baseY,
        bound,
      ),
    }
    return propPlug
      ? [drawPlugin(propPlug, propCtx)]
      : HELD_PROPS[who.prop as PropName].draw(propCtx)
  }
  const propLayer = holds
    ? [n('g', 'prop', {}, tier >= 2 ? propNodes() : [])]
    : []

  // full framing: the whole body plus hat room, centred and scaled down; the
  // prop and the fx ride inside the same transform so they follow the body
  let framed = av
  if (full) {
    const body: Node[] = [av, ...propLayer, fxLayer]
    const c = fullC
    // clay rests on a soft contact shadow under the body's bottom
    if (T.shading === 'clay')
      body.unshift(
        n('ellipse', 'shade.contact', {
          cx: 170,
          cy: f2(sh.bottom + baseY),
          rx: f2(sh.side * 0.82),
          ry: 13,
          fill: INK.ink,
          opacity: 0.16,
        }),
      )
    framed = n(
      'g',
      'framing',
      {
        transform: `translate(170 170) scale(${FULL_SCALE}) translate(-170 ${f2(-c)})`,
      },
      body,
    )
  }

  // the thing in the corner: a dot lattice from the mark's vocabulary
  const scene: Node[] = []
  if (o.frame !== 'none') {
    scene.push(n('rect', 'bg', { ...VBr, fill: frameFill }))
    const th = clamp(g('thing'), 0, 1)
    const dots: Node[] = []
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 3; i++) {
        const q = j * 3 + i
        const kk = smooth(q / 12, q / 12 + 0.35, th)
        dots.push(
          n('circle', `lattice.${q}`, {
            cx: 312 + i * 18,
            cy: 2 + j * 18,
            r: f2(1.2 + 2.2 * kk),
            opacity: f3(kk * 0.55),
          }),
        )
      }
    scene.push(n('g', 'lattice', { fill: dark ? INK.bone : INK.ink }, dots))
  }
  scene.push(framed)
  if (!full) scene.push(...propLayer, fxLayer)
  if (grainy)
    scene.push(
      n('rect', 'grain', {
        ...VBr,
        filter: `url(#${id}-grain)`,
        opacity: dark ? 0.3 : 0.16,
        'pointer-events': 'none',
      }),
    )

  // The presence ring: from 12 o'clock, clockwise, `progress` of the way. It
  // is state, not identity: it never joins the id, and a live tree always
  // carries the node (opacity 0 with no ring) so it can come and go without
  // a re-render. Framework adapters keep `ring` out of their re-render key.
  // A pulsing ring breathes only when live, peaking at the static phase so
  // the first live frame matches the solid static ring.
  if (o.ring) {
    const p = Number.isFinite(o.ring.progress ?? 1)
      ? clamp(o.ring.progress ?? 1, 0, 1)
      : 1
    const C = 2 * Math.PI * RING_R
    const arc = p < 1
    scene.push(
      n('circle', 'ring', {
        cx: 170,
        cy: 170,
        r: RING_R,
        fill: 'none',
        stroke: o.ring.color,
        'stroke-width': RING_W,
        'stroke-linecap': arc && p > 0 ? 'round' : undefined,
        'stroke-dasharray': arc ? `${f2(p * C)} ${f2(C)}` : undefined,
        transform: arc ? 'rotate(-90 170 170)' : undefined,
        opacity:
          o.live && o.ring.pulse
            ? f3(0.55 + 0.45 * Math.cos(5 * (pose.t - REST_T)))
            : undefined,
      }),
    )
  } else if (o.live)
    scene.push(
      n('circle', 'ring', {
        cx: 170,
        cy: 170,
        r: RING_R,
        fill: 'none',
        stroke: 'none',
        'stroke-width': RING_W,
        opacity: 0,
      }),
    )

  const root = n(
    'svg',
    'root',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: VB.join(' '),
      width: o.size,
      height: o.size,
      role: o.title === false ? undefined : 'img',
      'aria-label': o.title === false ? undefined : o.title,
      'aria-hidden': o.title === false ? 'true' : undefined,
      overflow: spill ? 'visible' : undefined,
    },
    [
      n('defs', 'defs', {}, defs),
      n(
        'g',
        'frame',
        { 'clip-path': spill ? undefined : `url(#${id}-f)` },
        scene,
      ),
    ],
  )
  return o.live ? root : (prune(root) ?? root)
}
