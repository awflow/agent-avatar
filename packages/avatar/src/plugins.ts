/*
 * Plugins: wardrobe items, held props, overlays, body shapes and themes a
 * caller adds at runtime. A plugin is reachable only through an explicit
 * override (`headwear: 'cat-ears'`, `shape: 'squircle'`, `fx: 'my-fx'`):
 * it never joins the hashed lists, so a name keeps its face whatever is
 * registered. Built-in names cannot be replaced; a custom name registered
 * again from a fresh object of the same kind replaces the old one (HMR).
 *
 * Server rendering: register the same plugins on the server and on the
 * client, before the first render. The live avatar's first paint must equal
 * the server frame; an override naming a plugin one side never registered
 * draws the name's own pick there instead (warned once in development).
 *
 * Every plugin drawing lands in one keyed group, `plugin.<name>`, with its
 * own nodes under `plugin.<name>.*`. A draw that throws or yields non-finite
 * numbers is skipped for that render and reported once per plugin; the group
 * stays, hidden, so a live tree keeps its node set. A plugin should return
 * the same nodes every frame, as built-in items do.
 */

import type { CharacterPlugin } from './character'
import type { FxAnchor, FxShape } from './fx'
import { FX_KINDS } from './fx'
import { seat } from './geom'
import { LISTS } from './identity'
import { el, type Node } from './node'
import type { SwingSpec } from './physics'
import { note, registry } from './registry'
import { FACES, type FaceGeom, type Part, PROPS } from './tables'
import { registerTheme, resetThemesForTests, type ThemePlugin } from './themes'
import type { WearCtx, WearDraw, WearSlot } from './wardrobe/context'

export type { ThemePlugin } from './themes'
export { defineTheme } from './themes'

export type AccessoryPlugin = {
  kind: 'accessory'
  slot: WearSlot
  name: string
  /** A swinging item gets its own spring on a live avatar, like built-ins. */
  physics?: SwingSpec
  draw: WearDraw
}
export type PropPlugin = { kind: 'prop'; name: string; draw: WearDraw }
export type FxPlugin = {
  kind: 'fx'
  name: string
  shapes: (t: number, p: number, anchor: FxAnchor) => FxShape[]
}
export type ShapePlugin = { kind: 'shape'; name: string; geom: FaceGeom }
export type {
  BrowState,
  CharacterCtx,
  CharacterLayers,
  CharacterPlugin,
  EyeState,
  MouthState,
} from './character'
export type Plugin =
  | AccessoryPlugin
  | PropPlugin
  | FxPlugin
  | ShapePlugin
  | CharacterPlugin
  | ThemePlugin

const SLOTS: readonly WearSlot[] = ['headwear', 'eyewear', 'neckwear', 'decor']
// the slots whose items swing on a spring of their own
const SPRUNG: readonly WearSlot[] = ['headwear', 'neckwear']
const NAME = /^[a-z][a-z0-9-]*$/

function checkName(name: unknown): asserts name is string {
  if (typeof name !== 'string' || !NAME.test(name) || name === 'none')
    throw new Error(
      `plugin name ${JSON.stringify(name)} must be lowercase letters, digits and dashes, starting with a letter, and not "none"`,
    )
}

const fn = (name: string, what: string, v: unknown) => {
  if (typeof v !== 'function')
    throw new Error(`plugin "${name}": ${what} must be a function`)
}

export function defineAccessory(
  p: Omit<AccessoryPlugin, 'kind'>,
): AccessoryPlugin {
  checkName(p.name)
  if (!SLOTS.includes(p.slot))
    throw new Error(
      `plugin "${p.name}": slot must be one of ${SLOTS.join(', ')}`,
    )
  fn(p.name, 'draw', p.draw)
  if (p.physics !== undefined) {
    if (!SPRUNG.includes(p.slot))
      throw new Error(
        `plugin "${p.name}": ${p.slot} does not swing, so it takes no physics`,
      )
    checkPhysics(p.name, p.physics)
  }
  return { kind: 'accessory', ...p }
}

export function defineProp(p: Omit<PropPlugin, 'kind'>): PropPlugin {
  checkName(p.name)
  fn(p.name, 'draw', p.draw)
  return { kind: 'prop', ...p }
}

export function defineFx(p: Omit<FxPlugin, 'kind'>): FxPlugin {
  checkName(p.name)
  fn(p.name, 'shapes', p.shapes)
  return { kind: 'fx', ...p }
}

// every number in a geometry; an array may hold numbers (or arrays) only
function numbers(at: string, v: unknown, path: string, out: number[]) {
  if (typeof v === 'number') out.push(v)
  else if (Array.isArray(v))
    for (const x of v) {
      if (typeof x !== 'number' && !Array.isArray(x))
        throw new Error(`${at} ${path} must hold numbers only`)
      numbers(at, x, path, out)
    }
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v))
      numbers(at, x, path ? `${path}.${k}` : k, out)
  return out
}

function deepFreeze<T>(v: T): T {
  if (v && typeof v === 'object') {
    for (const x of Object.values(v)) deepFreeze(x)
    Object.freeze(v)
  }
  return v
}

const SHAPE_NUMBERS = [
  'bottom',
  'sink',
  'rx',
  'ry',
  'pr',
  'crx',
  'cry',
  'hw',
  'side',
  'neck',
  'brow.y',
  'brow.hw',
  'brow.arch',
  'brow.w',
  'mouth.x',
  'mouth.y',
  'mouth.w',
  'mouth.d',
  'mouth.sw',
  'crown.r',
] as const

/**
 * A body shape. Its outline must be a single subpath: the half-width probe
 * the wardrobe sits on reads one closed outline, so holes and islands are
 * refused here rather than misplacing a scarf later. The geometry is stored
 * as a frozen copy: changing the object afterwards changes nothing drawn.
 */
export function defineShape(p: Omit<ShapePlugin, 'kind'>): ShapePlugin {
  checkName(p.name)
  return { kind: 'shape', ...p, geom: checkGeom(`shape "${p.name}":`, p.geom) }
}

// a geometry checked as defineShape checks it, returned as a frozen copy
function checkGeom(at: string, geom: unknown): FaceGeom {
  if (!geom || typeof geom !== 'object')
    throw new Error(`${at} geom is missing`)
  const g = structuredClone(geom) as FaceGeom
  const b = g.body as { d?: unknown; circle?: unknown } | undefined
  if (!b || (typeof b.d !== 'string' && !Array.isArray(b.circle)))
    throw new Error(`${at} body needs a path d or a circle`)
  if (typeof b.d === 'string') {
    const moves = b.d.match(/[Mm]/g)?.length ?? 0
    if (!/^\s*[Mm]/.test(b.d) || moves !== 1)
      throw new Error(`${at} body.d must be one subpath (a single M)`)
  }
  const pair = (v: unknown) => Array.isArray(v) && v.length === 2
  if (
    !pair(g.eyes) ||
    !pair(g.cheeks) ||
    !g.brow ||
    !g.mouth ||
    !g.crown ||
    !Array.isArray(g.crown.poly) ||
    g.crown.poly.length < 1
  )
    throw new Error(
      `${at} needs eyes and cheeks (two points each), brow, mouth and a crown polygon`,
    )
  for (const pts of ['eyes', 'cheeks'] as const)
    if (!g[pts].every((pt) => pair(pt)))
      throw new Error(`${at} ${pts} must be two [x, y] points`)
  if (!g.crown.poly.every((pt) => pair(pt)))
    throw new Error(`${at} crown.poly must be [x, y] points`)
  if (Array.isArray(b.circle) && b.circle.length !== 3)
    throw new Error(`${at} body.circle must be [cx, cy, r]`)
  if (g.speech !== undefined && !pair(g.speech))
    throw new Error(`${at} speech must be an [x, y] point`)
  for (const k of SHAPE_NUMBERS) {
    const v = k
      .split('.')
      .reduce<unknown>((o, f) => (o as Record<string, unknown>)?.[f], g)
    if (typeof v !== 'number') throw new Error(`${at} ${k} must be a number`)
  }
  const all = numbers(at, g, '', [])
  const s = seat(g.crown, 0, 0)
  if (![...all, s.x, s.y, s.a].every(Number.isFinite))
    throw new Error(`${at} every number must be finite`)
  return deepFreeze(g)
}

// the swing spec an accessory or a character declares, checked
function checkPhysics(name: string, spec: unknown) {
  const s = spec as Partial<Record<keyof SwingSpec, unknown>> | null
  const num = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v)
  if (
    !s ||
    !num(s.stiffness) ||
    !num(s.damping) ||
    !num(s.maxSwing) ||
    s.stiffness <= 0 ||
    s.damping < 0 ||
    s.maxSwing <= 0
  )
    throw new Error(
      `plugin "${name}": physics needs finite numbers: stiffness > 0, damping >= 0 and maxSwing > 0`,
    )
}

// the built-in parts a character may pin, by axis
const PINNABLE = ['eyes', 'brows', 'mouth', 'cheeks'] as const

/**
 * A character: a whole mascot drawn in body space, behind, as and in front
 * of the face, on the package's own rig. Its geometry is a body shape's
 * (checked as defineShape checks one): the anchors every built-in wardrobe
 * item, prop, overlay and ring is placed by. It may draw its own eyes, brows
 * and mouth, or pin built-in parts in `parts`; whatever it leaves out comes
 * from the name, as on any avatar. The geometry is stored as a frozen copy.
 */
export function defineCharacter(
  p: Omit<CharacterPlugin, 'kind'>,
): CharacterPlugin {
  checkName(p.name)
  const at = `character "${p.name}":`
  fn(p.name, 'draw', p.draw)
  for (const k of ['eye', 'brow', 'mouth'] as const)
    if (p[k] !== undefined) fn(p.name, k, p[k])
  if (p.physics !== undefined) checkPhysics(p.name, p.physics)
  if (
    p.lift !== undefined &&
    !(typeof p.lift === 'number' && p.lift > 0 && p.lift <= 2)
  )
    throw new Error(`${at} lift must be a number above 0, at most 2`)
  if (
    p.headroom !== undefined &&
    !(typeof p.headroom === 'number' && p.headroom >= 0 && p.headroom <= 400)
  )
    throw new Error(`${at} headroom must be a number from 0 to 400`)
  if (p.parts !== undefined) {
    if (!p.parts || typeof p.parts !== 'object')
      throw new Error(`${at} parts must be an object`)
    for (const [k, v] of Object.entries(p.parts)) {
      if (!(PINNABLE as readonly string[]).includes(k))
        throw new Error(`${at} parts may pin ${PINNABLE.join(', ')} only`)
      if (!(LISTS[k as Part] as readonly unknown[]).includes(v))
        throw new Error(`${at} parts.${k} ${JSON.stringify(v)} is not built in`)
    }
  }
  return {
    kind: 'character',
    ...p,
    geom: checkGeom(at, p.geom),
    ...(p.parts ? { parts: Object.freeze({ ...p.parts }) } : {}),
  }
}

/* the registry: one namespace for every kind but themes, which keep theirs */

// the state lives in the shared registry (registry.ts), so every entry
// point and every copy of the package on a page sees the same plugins
const names = () => registry().names

function builtIn(p: Exclude<Plugin, ThemePlugin>): string | null {
  switch (p.kind) {
    case 'accessory':
      return (LISTS[p.slot] as readonly string[]).includes(p.name)
        ? p.slot
        : null
    case 'prop':
      return (PROPS as readonly string[]).includes(p.name) ? 'prop' : null
    case 'fx':
      return (FX_KINDS as readonly string[]).includes(p.name) ? 'fx' : null
    case 'shape':
      return Object.hasOwn(FACES, p.name) ? 'shape' : null
    case 'character':
      return null
  }
}

const KINDS = new Set([
  'accessory',
  'prop',
  'fx',
  'shape',
  'character',
  'theme',
])

// the same kind of thing under the same name: a re-registration, not a clash
const sameKind = (a: Plugin, b: Plugin) =>
  a.kind === b.kind &&
  (a.kind !== 'accessory' || a.slot === (b as AccessoryPlugin).slot)

/**
 * Registers plugins. Register the same plugins on the server and on the
 * client, before the first render: an override naming a plugin the server
 * never registered renders what the name picked there, and the client's
 * first live paint would not match.
 *
 * Safe to call more than once: the same object again is a no-op; a fresh
 * object of the same kind (and slot) under a taken name replaces the old one
 * in place, last wins, with one warning in development, so a module that
 * re-runs under HMR keeps working. A clash with another kind, slot or a
 * built-in throws, and a list that throws registers nothing.
 */
export function registerPlugins(items: Plugin[]): void {
  if (!Array.isArray(items)) throw new Error('registerPlugins takes an array')
  const reg = registry()
  const staged = new Map(reg.names)
  const next = [...reg.list]
  const replaced: string[] = []
  const themes: ThemePlugin[] = []
  // each shape's or character's checked, frozen copy, kept beside the
  // plugin as passed
  const geoms: [ShapePlugin | CharacterPlugin, FaceGeom][] = []
  const themeAt = (name: string) =>
    next.findIndex((q) => q.kind === 'theme' && q.theme.name === name)
  for (const p of items) {
    if (next.includes(p)) continue
    if (!p || !KINDS.has(p.kind))
      throw new Error(
        'a plugin needs a kind: accessory, prop, fx, shape, character or theme',
      )
    if (p.kind === 'theme') {
      registerTheme(p.theme, true)
      // one entry per theme name: a re-registration takes the old one's place
      const i = themeAt(p.theme.name)
      if (i >= 0) next[i] = p
      else next.push(p)
      themes.push(p)
      continue
    }
    // re-check what define*() checked: a plugin may be a plain object
    const checked =
      p.kind === 'accessory'
        ? defineAccessory(p)
        : p.kind === 'prop'
          ? defineProp(p)
          : p.kind === 'fx'
            ? defineFx(p)
            : p.kind === 'character'
              ? defineCharacter(p)
              : defineShape(p)
    const kind = builtIn(checked)
    if (kind)
      throw new Error(
        `"${p.name}" is a built-in ${kind} and cannot be replaced`,
      )
    const had = staged.get(p.name)
    if (had && !sameKind(had, p))
      throw new Error(`"${p.name}" is taken by another plugin`)
    staged.set(p.name, p)
    if (checked.kind === 'shape' || checked.kind === 'character')
      geoms.push([p as ShapePlugin | CharacterPlugin, checked.geom])
    if (had) {
      next[next.indexOf(had)] = p
      replaced.push(p.name)
    } else next.push(p)
  }
  // nothing above registered anything: a list that throws leaves no trace
  for (const p of themes) registerTheme(p.theme)
  for (const [p, g] of geoms) reg.geoms.set(p, g)
  reg.names.clear()
  for (const [k, v] of staged) reg.names.set(k, v)
  reg.list = next
  reg.frozen = Object.freeze([...next])
  for (const name of replaced)
    note(
      `plugin:${name}`,
      `plugin "${name}" was registered again from a new object; the last registration wins`,
    )
}

/** Every registered plugin, in registration order. Read-only. */
export function plugins(): ReadonlyArray<Plugin> {
  return registry().frozen
}

/** Test-only (not on the package entry): forget every plugin and theme. */
export function resetPluginsForTests() {
  const reg = registry()
  reg.names.clear()
  reg.list = []
  reg.frozen = Object.freeze([])
  reg.warned.clear()
  reg.notes.clear()
  resetThemesForTests()
}

/* lookups for draw(), settle() and the rig */

export function accessoryOf(
  slot: WearSlot,
  name: unknown,
): AccessoryPlugin | undefined {
  const p = typeof name === 'string' ? names().get(name) : undefined
  return p?.kind === 'accessory' && p.slot === slot ? p : undefined
}

export function propOf(name: unknown): PropPlugin | undefined {
  const p = typeof name === 'string' ? names().get(name) : undefined
  return p?.kind === 'prop' ? p : undefined
}

export function fxOf(name: unknown): FxPlugin | undefined {
  const p = typeof name === 'string' ? names().get(name) : undefined
  return p?.kind === 'fx' ? p : undefined
}

export function shapeOf(name: unknown): ShapePlugin | undefined {
  const p = typeof name === 'string' ? names().get(name) : undefined
  return p?.kind === 'shape' ? p : undefined
}

export function characterOf(name: unknown): CharacterPlugin | undefined {
  const p = typeof name === 'string' ? names().get(name) : undefined
  return p?.kind === 'character' ? p : undefined
}

/** A body's geometry: a built-in face, else a registered shape. */
export function geomOf(face: string): FaceGeom {
  if (Object.hasOwn(FACES, face)) return FACES[face as keyof typeof FACES]
  const p = shapeOf(face)
  return (p && (registry().geoms.get(p) ?? p.geom)) as FaceGeom
}

/** A character's checked geometry. */
export function characterGeom(p: CharacterPlugin): FaceGeom {
  return registry().geoms.get(p) ?? p.geom
}

/**
 * What an avatar's body is placed by: its character's anchors when it wears
 * one that is registered, else its face's.
 */
export function bodyGeom(who: { face: string; character?: string }): FaceGeom {
  const c = characterOf(who.character)
  return c ? characterGeom(c) : geomOf(who.face)
}

function skip(p: Plugin, why: unknown) {
  const warned = registry().warned
  if (warned.has(p)) return
  warned.add(p)
  const name = p.kind === 'theme' ? p.theme.name : p.name
  const reason = why instanceof Error ? why.message : String(why)
  console.warn(`@awflow/avatar: plugin "${name}" skipped: ${reason}`)
}

const BAD = /NaN|Infinity/
const TAG = /^[a-zA-Z][a-zA-Z0-9]*$/
const ATTR = /^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/

// a plugin node made safe to serialise: checked tag and attribute names,
// undefined attributes dropped, every key under the plugin's prefix and
// unique within the plugin (a live tree finds nodes by key)
function rekey(node: Node, prefix: string, seen: Set<string>): Node {
  if (!node || typeof node.tag !== 'string' || typeof node.key !== 'string')
    throw new Error('draw returned something that is not a node')
  if (!TAG.test(node.tag))
    throw new Error(`bad tag ${JSON.stringify(node.tag)} on ${node.key}`)
  const key = node.key.startsWith(prefix) ? node.key : prefix + node.key
  if (seen.has(key)) throw new Error(`duplicate key ${key}`)
  seen.add(key)
  const attrs: Record<string, string> = {}
  for (const k in node.attrs) {
    const v: unknown = node.attrs[k]
    if (v === undefined) continue
    if (!ATTR.test(k))
      throw new Error(`bad attribute name ${JSON.stringify(k)} on ${key}`)
    const text = String(v)
    if (BAD.test(text)) throw new Error(`non-finite ${k} on ${key}`)
    attrs[k] = text
  }
  return {
    tag: node.tag,
    key,
    attrs,
    children: (node.children ?? []).map((c) => rekey(c, prefix, seen)),
  }
}

/**
 * A plugin's nodes made safe under `prefix`, keys unique within `seen`.
 * Throws on anything a node may not hold; the caller isolates it.
 */
export function safeNodes(
  out: unknown,
  prefix: string,
  seen: Set<string>,
): Node[] {
  if (!Array.isArray(out)) throw new Error('draw must return an array')
  return out.map((c) => rekey(c, prefix, seen))
}

/** Reports a failing plugin once and lets the render go on without it. */
export function skipPlugin(p: Plugin, why: unknown) {
  skip(p, why)
}

/**
 * Draws a wardrobe or prop plugin into its keyed group. On failure the group
 * is drawn empty and hidden: a static tree prunes it, a live one keeps it.
 */
export function drawPlugin(
  p: AccessoryPlugin | PropPlugin,
  ctx: WearCtx,
): Node {
  const key = `plugin.${p.name}`
  try {
    const out = p.draw(ctx)
    if (!Array.isArray(out)) throw new Error('draw must return an array')
    const seen = new Set<string>()
    return el(
      'g',
      key,
      {},
      out.map((c) => rekey(c, `${key}.`, seen)),
    )
  } catch (e) {
    skip(p, e)
    return el('g', key, { opacity: 0 })
  }
}

/** An fx plugin's shapes for this frame, or none when it fails. */
export function fxPluginShapes(
  p: FxPlugin,
  t: number,
  progress: number,
  anchor: FxAnchor,
): FxShape[] {
  try {
    const out = p.shapes(t, progress, { ...anchor })
    if (!Array.isArray(out)) throw new Error('shapes must return an array')
    for (const s of out) {
      if (!s || typeof s.d !== 'string') throw new Error('a shape needs a d')
      if (!Number.isFinite(s.opacity) || !Number.isFinite(s.strokeWidth))
        throw new Error('non-finite opacity or strokeWidth')
      for (const v of [s.d, s.fill, s.stroke, s.transform])
        if (typeof v === 'string' && BAD.test(v))
          throw new Error('non-finite path or transform')
    }
    return out
  } catch (e) {
    skip(p, e)
    return []
  }
}
