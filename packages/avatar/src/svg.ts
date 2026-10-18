/*
 * toSvg: a name in, a standalone SVG string out. Same input, same bytes, on
 * any machine. Shares its defaults with every adapter through settle().
 */

import { type Activity, activityOf } from './activity'
import {
  type DrawOptions,
  draw,
  type Frame,
  type Framing,
  type Gaze,
  type Node,
  type Pose,
  REST_T,
  type Ring,
  restPose,
} from './draw'
import { FX_KINDS } from './fx'
import { type Axes, fnv1a, type Identity, identify, LISTS } from './identity'
import { accessoryOf, characterOf, fxOf, propOf, shapeOf } from './plugins'
import { dev, note } from './registry'
import {
  COLORS,
  type Color,
  type Decor,
  type Expression,
  type Eyewear,
  type Face,
  type Headwear,
  type Motif,
  type Neckwear,
  PROPS,
  type Prop,
} from './tables'
import { deepOf, type Ink, parseHex, THEMES, themeOf } from './themes'
import type { WearSlot } from './wardrobe/context'

// a built-in name, or a registered plugin's (never hashed)
type Or<T> = T | (string & {})

export type AvatarOptions = Omit<
  Partial<Axes>,
  'color' | 'face' | 'eyewear' | 'headwear' | 'neckwear' | 'decor'
> & {
  /** The body silhouette: a built-in shape or a registered shape plugin. */
  shape?: Or<Face>
  /** A face decoration (v2+). Under version 1 it keeps Peek's meaning: the silhouette. */
  face?: Or<Decor | Face>
  eyewear?: Or<Eyewear>
  headwear?: Or<Headwear>
  neckwear?: Or<Neckwear>
  decor?: Or<Decor>
  /** 'peek@1' | 'peek@2': pins the version; an explicit version wins. */
  style?: 'peek@1' | 'peek@2'
  /**
   * A registered character plugin by name: a whole mascot drawn on the rig
   * in place of the body. Unknown names draw the avatar as without one.
   */
  character?: string
  /** A hand-held prop, built-in or a registered prop plugin; never hashed. */
  prop?: Or<Prop>
  /** A palette slot, or any #rgb / #rrggbb hex for a custom body ink. */
  color?: Color | `#${string}`
  /** Draw this motif; default the hash's, or plain on themes without motifs. */
  motif?: Motif
  /** A registered theme name. Default soft (peek's palette). */
  theme?: string
  /** px. Drives the stroke ramp (thicker below 96) and the riso print. */
  size?: number
  expression?: Expression
  /** What the agent is doing, layered over the expression. Unknown is idle. */
  activity?: Activity
  /** Where the eyes look, x and y in -1..1. */
  gaze?: Gaze
  frame?: Frame
  /** false clips the frame to a circle. Default true. */
  square?: boolean
  /** Accessible name, default the name; false marks it decorative. */
  title?: string | false
  /** Riso plates and grain, visible from 120px up. Default off. */
  riso?: boolean
  /** Pin a style version. Default the latest. */
  version?: number
  /** Let the name pick the wardrobe too (v2+). Default off. */
  dress?: boolean
  /**
   * A presence ring around the frame; progress 0..1 draws an arc, pulse
   * breathes it when live. State, not identity: it never changes the id, and
   * framework adapters keep it out of their re-render key.
   */
  ring?: Ring | null
  /**
   * false hides every overlay; true (the default) draws the activity's and
   * the reaction's; a string also draws that overlay by name.
   */
  fx?: boolean | string
  /** 'peek' crops at the floor (default); 'full' shows the whole body. */
  framing?: Framing
  /** Thin the face out at small sizes. Default on from version 2, off at 1. */
  lod?: boolean
  /** Prefix for ids inside the SVG. Default derived from everything drawn,
   * so two different avatars inlined in one page never share defs. */
  id?: string
}

// an unknown value from untyped callers keeps what the name picked
const take = <A extends keyof Axes>(axis: A, v: unknown, base: Axes[A]) =>
  (LISTS[axis] as readonly unknown[]).includes(v) ? (v as Axes[A]) : base

// a registered plugin is reachable by override only, never by the hash
const wearOr = <A extends WearSlot>(axis: A, v: unknown, base: Axes[A]) =>
  accessoryOf(axis, v) ? (v as Axes[A]) : take(axis, v, base)
const shapeOr = (v: unknown, base: Face) =>
  shapeOf(v) ? (v as Face) : take('face', v, base)

const clamp01 = (v: number) =>
  Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1

/**
 * In development, one warning per axis and value for an override that names
 * neither a built-in nor a registered plugin: most often a plugin the server
 * (or this bundle) never registered, which then renders what the name picked
 * and lets a server frame and its first live paint disagree.
 */
function unknownOverrides(o: AvatarOptions, v1: boolean) {
  const known = (axis: string, v: unknown): boolean => {
    switch (axis) {
      case 'shape':
        return !!shapeOf(v) || (LISTS.face as readonly unknown[]).includes(v)
      case 'prop':
        return !!propOf(v) || (PROPS as readonly unknown[]).includes(v)
      case 'theme':
        return (
          themeOf(v as string).name === v || Object.hasOwn(THEMES, v as string)
        )
      case 'fx':
        return !!fxOf(v) || (FX_KINDS as readonly unknown[]).includes(v)
      case 'character':
        return !!characterOf(v)
      default:
        return (
          !!accessoryOf(axis as WearSlot, v) ||
          (LISTS[axis as WearSlot] as readonly unknown[]).includes(v)
        )
    }
  }
  const asked: [string, unknown][] = [
    ['shape', o.shape ?? (v1 ? o.face : undefined)],
    ['eyewear', o.eyewear],
    ['headwear', o.headwear],
    ['neckwear', o.neckwear],
    ['decor', v1 ? o.decor : (o.face ?? o.decor)],
    ['prop', o.prop],
    ['theme', o.theme],
    ['fx', o.fx],
    ['character', o.character],
  ]
  for (const [axis, v] of asked)
    if (typeof v === 'string' && !known(axis, v))
      note(
        `override:${axis}:${v}`,
        `${axis} "${v}" is neither built in nor registered, so the name's own pick is drawn. Register the same plugins on the server and the client before the first render.`,
      )
}

const STYLES = { 'peek@1': 1, 'peek@2': 2 } as const

/**
 * A name decides identity unless the caller overrides an axis: an explicit
 * face, color or part wins over the hash, and every other axis stays put.
 */
export function settle(
  name: string,
  o: AvatarOptions,
  live = false,
): {
  who: Identity & { prop: Prop; character?: string }
  pose: Pose
  opts: DrawOptions
} {
  const version =
    o.version ??
    (typeof o.style === 'string' && Object.hasOwn(STYLES, o.style)
      ? STYLES[o.style]
      : undefined)
  const base = identify(name, { version, dress: o.dress })
  // under v1 `face` is the silhouette (Peek's meaning); from v2 it is decor
  const v1 = base.version < 2
  if (dev()) unknownOverrides(o, v1)
  const theme = themeOf(o.theme)
  const hex = typeof o.color === 'string' ? parseHex(o.color) : null
  const ink: Ink | undefined = hex
    ? { body: hex, deep: deepOf(hex) }
    : undefined
  const named =
    typeof o.color === 'string' && Object.hasOwn(COLORS, o.color)
      ? (o.color as Color)
      : undefined
  // a character pins the parts it names; an explicit option still wins
  const char = characterOf(o.character)
  const pin = char?.parts ?? {}
  const who: Identity & { prop: Prop; character?: string } = {
    ...base,
    face: shapeOr(o.shape ?? (v1 ? o.face : undefined), base.face),
    color: named ?? base.color,
    eyes: take('eyes', o.eyes, pin.eyes ?? base.eyes),
    brows: take('brows', o.brows, pin.brows ?? base.brows),
    mouth: take('mouth', o.mouth, pin.mouth ?? base.mouth),
    cheeks: take('cheeks', o.cheeks, pin.cheeks ?? base.cheeks),
    trait: take('trait', o.trait, base.trait),
    eyewear: wearOr('eyewear', o.eyewear, base.eyewear),
    headwear: wearOr('headwear', o.headwear, base.headwear),
    neckwear: wearOr('neckwear', o.neckwear, base.neckwear),
    // the theme decides whether the hashed motif is drawn at all
    motif: theme.motifs
      ? take('motif', o.motif, base.motif)
      : take('motif', o.motif, 'plain'),
    decor: wearOr('decor', v1 ? o.decor : (o.face ?? o.decor), base.decor),
    prop:
      (PROPS as readonly unknown[]).includes(o.prop) || propOf(o.prop)
        ? (o.prop as Prop)
        : 'none',
    // only when one is drawn: without one, every existing id holds
    ...(char ? { character: char.name } : {}),
  }
  const pose = restPose(
    who,
    o.expression ?? 'normal',
    o.gaze,
    activityOf(o.activity),
  )
  const look = {
    size: o.size ?? 64,
    frame: o.frame ?? (theme.name === 'soft' ? 'ink' : 'theme'),
    square: o.square ?? true,
    riso: o.riso ?? false,
    live,
  }
  const framing: Framing = o.framing === 'full' ? 'full' : 'peek'
  const ring =
    o.ring && typeof o.ring.color === 'string'
      ? {
          color: o.ring.color,
          progress: clamp01(o.ring.progress ?? 1),
          pulse: o.ring.pulse === true,
        }
      : null
  const lodDefault = who.version >= 2
  const lod = typeof o.lod === 'boolean' ? o.lod : lodDefault
  const fx = typeof o.fx === 'string' || o.fx === false ? o.fx : true
  // theme name, custom ink, framing, a non-default lod and fx join the id
  // only when set: existing ids hold. The ring never does: it is state, has
  // no defs to collide, and must change without a new id.
  const extra = {
    ...(theme.name === 'soft' ? {} : { theme: theme.name }),
    ...(ink ? { ink } : {}),
    ...(framing === 'full' ? { framing } : {}),
    ...(lod !== lodDefault ? { lod } : {}),
    ...(fx !== true ? { fx } : {}),
  }
  // Keep the byte-level peek@1 contract: an axis at its v1 default (no
  // wardrobe, plain motif, no decor) stays out of the hashed identity.
  const hashed: Partial<Identity & { prop: Prop }> = { ...who }
  if (who.prop === 'none') delete hashed.prop
  if (who.motif === 'plain') delete hashed.motif
  if (who.decor === 'none') delete hashed.decor
  if (
    who.eyewear === 'none' &&
    who.headwear === 'none' &&
    who.neckwear === 'none'
  ) {
    delete hashed.eyewear
    delete hashed.headwear
    delete hashed.neckwear
  }
  // new pose fields join the id only off their defaults: existing ids hold
  const hp: Partial<Pose> = { ...pose }
  if (pose.activity === 'idle') delete hp.activity
  if (pose.t === REST_T) delete hp.t
  if (pose.wob === 0) delete hp.wob
  if (pose.fx === null) delete hp.fx
  if (pose.fxP === 0) delete hp.fxP
  if (pose.voice === -1) delete hp.voice
  if (pose.winkR === 0) delete hp.winkR
  if (!pose.swing) delete hp.swing
  // focus follows from the activity, already hashed: never on its own
  delete hp.focus
  const id =
    o.id ??
    `${who.version >= 2 ? 'awf' : 'peek'}-${fnv1a(JSON.stringify([hashed, hp, { ...look, ...extra }])).toString(36)}`
  return {
    who,
    pose,
    opts: {
      ...look,
      theme,
      ink,
      id,
      title: o.title ?? name,
      framing,
      ring,
      lod,
      fx,
    },
  }
}

// characters XML 1.0 cannot hold at all: C0 controls and lone surrogates
const ILLEGAL =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the point
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

const esc = (s: string) =>
  s
    .replace(ILLEGAL, '\uFFFD')
    .replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
    )

export function serialize(node: Node): string {
  let a = ''
  for (const k in node.attrs) a += ` ${k}="${esc(node.attrs[k]!)}"`
  if (!node.children.length) return `<${node.tag}${a}/>`
  return `<${node.tag}${a}>${node.children.map(serialize).join('')}</${node.tag}>`
}

export function toSvg(name: string, props: AvatarOptions = {}): string {
  const { who, pose, opts } = settle(name, props)
  return serialize(draw(who, pose, opts))
}
