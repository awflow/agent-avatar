/*
 * Themes: how a face is coloured and inked. A theme owns the twelve body
 * slots, the structure inks (features, sclera, pupil, frame) and the looks
 * that go with them. The Soft theme is Peek's palette and is the default, so
 * output without a theme stays byte-identical to peek@1.
 */

import { COLORS, type Color, INK } from './tables'

export type Ink = { body: string; deep: string }

export type Theme = {
  name: string
  /** Default frame fill (the `frame` option still overrides it). */
  frame: string
  /** All 12 slots. */
  colors: Record<Color, Ink>
  /** Features: brows, mouth, rims. */
  ink: (c: Ink) => string
  sclera: (c: Ink) => string
  pupil: (c: Ink) => string
  /** Hash motifs when true. */
  motifs: boolean
  motifInk: (c: Ink) => string
  motifOpacity: number
  shading: 'flat' | 'bold' | 'clay'
  /** Outline in 340-unit space. */
  outline: null | { color: (c: Ink) => string; width: number; glow: boolean }
}

const NAMES = Object.keys(COLORS) as Color[]

const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i
const HEX6 = /^#[0-9a-f]{6}$/i

/** '#abc' | '#aabbcc' (any case) to '#aabbcc'; anything else null. */
export function parseHex(s: string): string | null {
  if (typeof s !== 'string') return null
  const m = HEX3.exec(s)
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase()
  return HEX6.test(s) ? s.toLowerCase() : null
}

/** Darken 25% toward black, per channel, rounded. */
export function deepOf(hex: string): string {
  const v = Number.parseInt(hex.slice(1), 16)
  const c = (n: number) =>
    Math.round(n * 0.75)
      .toString(16)
      .padStart(2, '0')
  return `#${c(v >> 16)}${c((v >> 8) & 255)}${c(v & 255)}`
}

const slots = (f: (i: number, name: Color) => Ink) =>
  Object.fromEntries(NAMES.map((n, i) => [n, f(i, n)])) as Record<Color, Ink>
const pairs = (list: readonly (readonly [string, string])[]) =>
  slots((i) => ({
    body: list[i % list.length]![0],
    deep: list[i % list.length]![1],
  }))

const BOLD = [
  '#5fb3a1',
  '#f0a54a',
  '#5b5bd6',
  '#8b5cf6',
  '#4f86f7',
  '#ea7a3f',
  '#e5677a',
  '#7cb342',
  '#e0b83c',
  '#6b7280',
  '#c084fc',
  '#2dd4bf',
] as const
const MONO_DEEP = [
  '#F3D9C8',
  '#D8E3F0',
  '#DCEBD9',
  '#EADCF2',
  '#F2E6B8',
  '#F2D3DC',
] as const
const NEON = [
  ['#1E1733', '#B57BFF'],
  ['#0F2730', '#3EE6F0'],
  ['#16260F', '#9BF24A'],
  ['#2E1324', '#FF5FB0'],
  ['#2C2010', '#FFB547'],
  ['#121E36', '#5C9CFF'],
] as const
const CLAY = [
  ['#F28C6B', '#C9573A'],
  ['#7DB7E8', '#4C86BE'],
  ['#9CD08A', '#5F9E4F'],
  ['#F5C451', '#C9952A'],
  ['#C39BE8', '#8E62BF'],
  ['#F49AC1', '#C9628F'],
  ['#6FD3C4', '#36A091'],
  ['#B8B2A7', '#857F75'],
  ['#E8836F', '#B44F3C'],
  ['#8FA8F0', '#5A73C2'],
  ['#E9A86A', '#B9773B'],
  ['#A8C9E0', '#6F98B5'],
] as const

const soft: Theme = {
  name: 'soft',
  frame: INK.ink,
  colors: COLORS,
  ink: () => INK.ink,
  sclera: () => INK.paper,
  pupil: () => INK.ink,
  motifs: false,
  motifInk: (c) => c.deep,
  motifOpacity: 0.55,
  shading: 'flat',
  outline: null,
}

const bold: Theme = {
  name: 'bold',
  frame: INK.bone,
  colors: slots((i) => ({ body: BOLD[i]!, deep: deepOf(BOLD[i]!) })),
  ink: () => '#1C1714',
  sclera: () => '#FFFFFF',
  pupil: () => '#1C1714',
  motifs: true,
  motifInk: () => '#FFFFFF',
  motifOpacity: 0.3,
  shading: 'bold',
  outline: null,
}

const mono: Theme = {
  name: 'mono',
  frame: INK.bone,
  colors: slots((i) => ({ body: INK.paper, deep: MONO_DEEP[i % 6]! })),
  ink: () => INK.ink,
  sclera: () => INK.paper,
  pupil: () => INK.ink,
  motifs: true,
  motifInk: () => INK.ink,
  motifOpacity: 0.12,
  shading: 'flat',
  outline: { color: () => INK.ink, width: 7.5, glow: false },
}

const neon: Theme = {
  name: 'neon',
  frame: '#0D0E13',
  colors: pairs(NEON),
  ink: (c) => c.deep,
  sclera: (c) => c.deep,
  pupil: () => '#0D0E13',
  motifs: true,
  motifInk: (c) => c.deep,
  motifOpacity: 0.22,
  shading: 'flat',
  outline: { color: (c) => c.deep, width: 6, glow: true },
}

const clay: Theme = {
  name: 'clay',
  frame: '#EFE9DF',
  colors: pairs(CLAY),
  ink: () => '#2A211C',
  sclera: () => '#FFFFFF',
  pupil: () => '#2A211C',
  motifs: false,
  motifInk: (c) => c.deep,
  motifOpacity: 0.55,
  shading: 'clay',
  outline: null,
}

export const THEMES: Record<'soft' | 'bold' | 'mono' | 'neon' | 'clay', Theme> =
  { soft, bold, mono, neon, clay }

const registry = new Map<string, Theme>(Object.entries(THEMES))

/** Register a theme by name (replaces one of the same name). */
export function defineTheme(t: Theme): Theme {
  registry.set(t.name, t)
  return t
}

/** A theme by name; unknown or missing is soft. */
export function themeOf(name?: string): Theme {
  return (name !== undefined && registry.get(name)) || soft
}
