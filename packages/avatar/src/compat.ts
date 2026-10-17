/**
 * Compat helpers: map AWFlow's legacy agent looks onto AvatarOptions.
 * Deliberately a separate subpath; the main entry stays frozen.
 */
import type { AvatarOptions } from './svg'

export type LegacyAvatar = {
  icon?: string
  color: string
  shape?: string
  motif?: string
  eyes?: string
  acc?: string
}

const SHAPES: Record<string, string> = {
  pebble: 'circle',
  cube: 'cube',
  peak: 'peak',
  drop: 'drop',
  gem: 'gem',
  cloud: 'cloud',
  ghost: 'ghost',
}
const EYES: Record<string, string> = {
  pills: 'pill',
  dots: 'dot',
  round: 'oval',
  sleepy: 'bead',
  spark: 'spark',
}
const HEADWEAR = new Set(['beanie', 'headphones', 'antenna', 'bow'])

type Partial9 = Partial<LegacyAvatar>

function map(av: Partial9): AvatarOptions {
  const o: Record<string, unknown> = {}
  const shape = av.shape && SHAPES[av.shape]
  if (shape) o.shape = shape
  if (av.color) o.color = av.color
  o.motif = av.motif && av.motif !== 'rays' ? av.motif : 'plain'
  o.eyes = (av.eyes && EYES[av.eyes]) || 'pill'
  if (av.acc === 'glasses') o.eyewear = 'glasses'
  else if (av.acc && HEADWEAR.has(av.acc)) o.headwear = av.acc
  o.brows = 'none'
  o.mouth = 'none'
  o.cheeks = 'none'
  o.trait = 'none'
  return o as AvatarOptions
}

/** A stored AWFlow look as avatar options. */
export function fromLegacy(av: LegacyAvatar): AvatarOptions {
  return { theme: 'bold', ...map(av) }
}

/** Aria's signature look. */
export const ARIA: AvatarOptions = {
  theme: 'bold',
  shape: 'circle',
  color: '#f08a24',
  motif: 'rays',
  eyes: 'pill',
  brows: 'none',
  mouth: 'line',
  cheeks: 'oval',
  trait: 'none',
}

const ROLE_LOOKS: [RegExp, Partial9][] = [
  [
    /\b(travel|trip|flight|hotel|vacation|holiday)/i,
    { shape: 'drop', color: '#4f86f7', motif: 'dots', acc: 'headphones' },
  ],
  [
    /\b(research|search|sources?|analy|study|fact)/i,
    {
      shape: 'pebble',
      color: '#2dd4bf',
      motif: 'grid',
      eyes: 'round',
      acc: 'glasses',
    },
  ],
  [
    /\b(writ|draft|copy|blog|edit|story)/i,
    {
      shape: 'cube',
      color: '#e5677a',
      motif: 'waves',
      eyes: 'spark',
      acc: 'bow',
    },
  ],
  [/\b(mail|inbox|email|reply|message)/i, { shape: 'peak', color: '#5b5bd6' }],
  [
    /\b(price|deal|shop|buy|watch|track|monitor)/i,
    { shape: 'ghost', color: '#e0b83c', motif: 'speckle', acc: 'antenna' },
  ],
  [
    /\b(code|dev|bug|github|engineer)/i,
    { shape: 'cube', color: '#6b7280', motif: 'grid', acc: 'antenna' },
  ],
  [
    /\b(money|expense|finance|budget|invoice|receipt)/i,
    { shape: 'gem', color: '#7cb342', motif: 'stripes' },
  ],
  [
    /\b(sales|lead|outreach|prospect)/i,
    { shape: 'pebble', color: '#f0a54a', motif: 'speckle' },
  ],
  [
    /\b(learn|teach|tutor|quiz|study)/i,
    { shape: 'cloud', color: '#8b5cf6', motif: 'glow', acc: 'beanie' },
  ],
]

/** A look suited to what an agent does; `{}` when nothing matches. */
export function lookForRole(text: string): AvatarOptions {
  const hit = ROLE_LOOKS.find(([re]) => re.test(text))
  return hit ? map(hit[1]) : {}
}
