/*
 * Attribute text to avatar options. A value that does not parse is ignored
 * (`undefined` here), never an error: the previous value stays. A removed
 * attribute (`null`) resets its option.
 */
import type { MountOptions } from '@awflow/avatar/adapter'

const BOOLEANS = new Set(['animate', 'dress', 'riso', 'square'])
const NUMBERS = new Set(['size', 'version'])
const STRINGS = [
  'name',
  'theme',
  'framing',
  'frame',
  'expression',
  'activity',
  'shape',
  'color',
  'eyes',
  'brows',
  'mouth',
  'cheeks',
  'trait',
  'motif',
  'headwear',
  'eyewear',
  'neckwear',
  'face',
  'prop',
  'character',
  'reaction',
]

/** The option name each observed attribute maps to. */
export const ATTRIBUTES: Record<string, keyof MountOptions> = {
  ...Object.fromEntries(
    [...NUMBERS, ...BOOLEANS, ...STRINGS, 'gaze', 'fx', 'ring'].map((k) => [
      k,
      k as keyof MountOptions,
    ]),
  ),
  'react-key': 'reactKey',
  label: 'title',
}

const clamp = (n: number) => Math.max(-1, Math.min(1, n))

export function parseGaze(
  text: string,
): [number, number] | 'pointer' | undefined {
  const t = text.trim()
  if (t === 'pointer') return 'pointer'
  const parts = t.split(',')
  if (parts.length !== 2 || parts.some((p) => p.trim() === '')) return
  const [x, y] = parts.map((p) => Number(p))
  if (Number.isNaN(x) || Number.isNaN(y)) return
  return [clamp(x!), clamp(y!)]
}

export type Parsed = { key: keyof MountOptions; value: unknown } | undefined

/** One attribute's change as an option patch entry, or undefined to skip. */
export function parseAttribute(attr: string, text: string | null): Parsed {
  const key = ATTRIBUTES[attr]
  if (!key) return
  if (text === null) {
    return { key, value: undefined }
  }
  if (BOOLEANS.has(attr)) return { key, value: text !== 'false' }
  if (NUMBERS.has(attr)) {
    if (text.trim() === '') return
    const n = Number(text)
    return Number.isNaN(n) ? undefined : { key, value: n }
  }
  if (attr === 'gaze') {
    const g = parseGaze(text)
    return g === undefined ? undefined : { key, value: g }
  }
  if (attr === 'ring') {
    try {
      const v: unknown = JSON.parse(text)
      return v && typeof v === 'object' && !Array.isArray(v)
        ? { key, value: v }
        : undefined
    } catch {
      return
    }
  }
  if (attr === 'fx') {
    return {
      key,
      value:
        text === 'false' ? false : text === '' || text === 'true' ? true : text,
    }
  }
  if (attr === 'label') return { key, value: text === 'false' ? false : text }
  return { key, value: text }
}
