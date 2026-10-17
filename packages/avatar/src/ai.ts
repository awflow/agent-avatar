/**
 * AI helpers: a JSON Schema for the overridable look, a system prompt, and a
 * forgiving validator for a model's answer. No network, no model, no
 * dependency: the caller brings the model. Enums are built at call time, so
 * registered plugins and themes are included.
 *
 * The `rays` motif is reserved for Aria and left out of the enum, so a model
 * never picks it and parseLook drops it.
 */
import { LISTS } from './identity'
import { plugins } from './plugins'
import type { AvatarOptions } from './svg'
import { FACES, PROPS } from './tables'
import { parseHex, themeNames } from './themes'

const HEX = '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'
const HEX_RE = new RegExp(HEX)
const RESERVED_MOTIFS = new Set(['rays'])

type Axis =
  | 'theme'
  | 'shape'
  | 'eyes'
  | 'brows'
  | 'mouth'
  | 'cheeks'
  | 'trait'
  | 'motif'
  | 'headwear'
  | 'eyewear'
  | 'neckwear'
  | 'face'
  | 'prop'

const ENUM_AXES: Axis[] = [
  'theme',
  'shape',
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
]

const WHAT: Record<Axis | 'color', string> = {
  theme: 'the rendering palette and finish',
  shape: 'the body silhouette',
  color: 'the body colour: a palette slot name or a #rgb / #rrggbb hex',
  eyes: 'the eye style',
  brows: 'the eyebrow style',
  mouth: 'the mouth style',
  cheeks: 'the cheek marks',
  trait: 'a small body feature',
  motif: 'the pattern on the body',
  headwear: 'what it wears on its head',
  eyewear: 'what it wears on its eyes',
  neckwear: 'what it wears around its neck',
  face: 'a face decoration',
  prop: 'a hand-held object',
}

const accessory = (slot: string) =>
  plugins().flatMap((p) =>
    p.kind === 'accessory' && p.slot === slot ? [p.name] : [],
  )

function values(): Record<Axis, string[]> {
  const kind = (k: string) =>
    plugins().flatMap((p) =>
      p.kind === k && 'name' in p ? [p.name as string] : [],
    )
  return {
    theme: themeNames(),
    shape: [...Object.keys(FACES), ...kind('shape')],
    eyes: [...LISTS.eyes],
    brows: [...LISTS.brows],
    mouth: [...LISTS.mouth],
    cheeks: [...LISTS.cheeks],
    trait: [...LISTS.trait],
    motif: LISTS.motif.filter((m) => !RESERVED_MOTIFS.has(m)),
    headwear: [...LISTS.headwear, ...accessory('headwear')],
    eyewear: [...LISTS.eyewear, ...accessory('eyewear')],
    neckwear: [...LISTS.neckwear, ...accessory('neckwear')],
    face: [...LISTS.decor, ...accessory('decor')],
    prop: [...PROPS, ...kind('prop')],
  }
}

/** JSON Schema (draft 2020-12) of the look a model may set. */
export function lookSchema(): object {
  const v = values()
  const properties: Record<string, unknown> = {}
  for (const a of ENUM_AXES)
    properties[a] = { type: 'string', enum: v[a], description: WHAT[a] }
  properties.color = {
    description: WHAT.color,
    anyOf: [
      { type: 'string', enum: [...LISTS.color] },
      { type: 'string', pattern: HEX },
    ],
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    properties,
  }
}

/** A system prompt that asks a model for a look as JSON only. */
export function lookPrompt(opts: { locale?: string } = {}): string {
  const v = values()
  const lines = [
    'You design the look of a small avatar. Answer with a single JSON object and nothing else: no prose, no code fence.',
    'Every key is optional; leave out what the request does not call for. Never invent values: use only the ones listed, and no other keys.',
    '',
    ...ENUM_AXES.map((a) => `- ${a}: ${WHAT[a]}. One of: ${v[a].join(', ')}.`),
    `- color: ${WHAT.color}. Slots: ${LISTS.color.join(', ')}.`,
  ]
  if (opts.locale)
    lines.push(
      '',
      `The request may be written in ${opts.locale}; answer in JSON only.`,
    )
  return lines.join('\n')
}

/** Validates a model's answer: keeps what is valid, drops the rest, never throws. */
export function parseLook(input: unknown): AvatarOptions {
  const out: Record<string, string> = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out
  const src = input as Record<string, unknown>
  const v = values()
  for (const a of ENUM_AXES) {
    if (!Object.hasOwn(src, a)) continue
    const x = src[a]
    if (typeof x === 'string' && v[a].includes(x)) out[a] = x
  }
  if (Object.hasOwn(src, 'color')) {
    const c = src.color
    if (typeof c === 'string') {
      if ((LISTS.color as readonly string[]).includes(c)) out.color = c
      else if (HEX_RE.test(c)) {
        const hex = parseHex(c)
        if (hex) out.color = hex
      }
    }
  }
  return out as AvatarOptions
}
