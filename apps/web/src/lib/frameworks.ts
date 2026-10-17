/*
 * The seven ways in, as code. One function writes the same avatar for every
 * framework, so the home page, Get started and the playground never drift
 * apart. Values are plain props: strings, numbers, booleans, a gaze pair.
 */

export const FRAMEWORKS = [
  'Svelte',
  'React',
  'Vue',
  'Solid',
  'Web Component',
  'Vanilla',
  'toSvg',
] as const
export type Framework = (typeof FRAMEWORKS)[number]

export type Value = string | number | boolean | readonly [number, number]
/** Props in the order they should print; `name` goes first on its own. */
export type Look = Record<string, Value | undefined>

export const INSTALL: Record<Framework, string> = {
  Svelte: 'npm i @awflow/avatar-svelte',
  React: 'npm i @awflow/avatar-react',
  Vue: 'npm i @awflow/avatar-vue',
  Solid: 'npm i @awflow/avatar-solid',
  'Web Component': 'npm i @awflow/avatar-element',
  Vanilla: 'npm i @awflow/avatar',
  toSvg: 'npm i @awflow/avatar',
}

/** The highlighter's language for each framework's snippet. */
export const LANG: Record<Framework, 'tsx' | 'ts' | 'html'> = {
  Svelte: 'html',
  React: 'tsx',
  Vue: 'html',
  Solid: 'tsx',
  'Web Component': 'html',
  Vanilla: 'ts',
  toSvg: 'ts',
}

const entries = (look: Look) =>
  Object.entries(look).filter(
    (e): e is [string, Value] => e[1] !== undefined && e[0] !== 'name',
  )

const q = (s: string) => JSON.stringify(s)
const sq = (s: string) =>
  `'${s.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`

function jsValue(v: Value): string {
  if (typeof v === 'string') return sq(v)
  if (Array.isArray(v)) return `[${v.join(', ')}]`
  return String(v)
}

/* JSX-like attributes: Svelte, React and Solid share one syntax */
function jsxAttrs(look: Look): string {
  return entries(look)
    .map(([k, v]) => {
      if (v === true) return k
      if (typeof v === 'string') return `${k}=${q(v)}`
      return `${k}={${jsValue(v)}}`
    })
    .join(' ')
}

function vueAttrs(look: Look): string {
  return entries(look)
    .map(([k, v]) => {
      if (v === true) return k
      if (typeof v === 'string') return `${k}=${q(v)}`
      return `:${k}="${jsValue(v)}"`
    })
    .join(' ')
}

// attributes are the options; booleans by presence, `="false"` is false
function htmlAttrs(look: Look): string {
  return entries(look)
    .map(([k, v]) => {
      if (v === true) return k
      if (Array.isArray(v)) return `${k}="${v.join(',')}"`
      return `${k}=${q(String(v))}`
    })
    .join(' ')
}

function objectLiteral(look: Look, indent: string): string {
  const e = entries(look)
  if (!e.length) return '{}'
  return `{\n${e.map(([k, v]) => `${indent}  ${k}: ${jsValue(v)},`).join('\n')}\n${indent}}`
}

const join = (...parts: string[]) => parts.filter(Boolean).join(' ')

/** One avatar, written for one framework. */
export function snippet(fw: Framework, name: string, look: Look): string {
  switch (fw) {
    case 'Svelte':
      return `<script>
  import { Avatar } from '@awflow/avatar-svelte'
</script>

<${join('Avatar', `name=${q(name)}`, jsxAttrs(look))} />`
    case 'React':
      return `import { Avatar } from '@awflow/avatar-react'

export function Face() {
  return <${join('Avatar', `name=${q(name)}`, jsxAttrs(look))} />
}`
    case 'Vue':
      return `<script setup lang="ts">
import { Avatar } from '@awflow/avatar-vue'
</script>

<template>
  <${join('Avatar', `name=${q(name)}`, vueAttrs(look))} />
</template>`
    case 'Solid':
      return `import { Avatar } from '@awflow/avatar-solid'

export function Face() {
  return <${join('Avatar', `name=${q(name)}`, jsxAttrs(look))} />
}`
    case 'Web Component':
      return `<script type="module">
  import '@awflow/avatar-element'
</script>

<${join('awf-avatar', `name=${q(name)}`, htmlAttrs(look))}></awf-avatar>`
    case 'Vanilla': {
      const lines = [`  name: ${sq(name)},`].concat(
        entries(look).map(([k, v]) => `  ${k}: ${jsValue(v)},`),
      )
      return `import { mount } from '@awflow/avatar'

const el = document.querySelector('#me')!
const avatar = mount(el, {
${lines.join('\n')}
})`
    }
    case 'toSvg': {
      // a string has no rig and no pointer: those props stay out
      const { animate: _a, gaze, ...rest } = look
      const still = {
        ...rest,
        ...(Array.isArray(gaze) ? { gaze } : {}),
      }
      const args = entries(still).length ? `, ${objectLiteral(still, '')}` : ''
      return `import { toSvg } from '@awflow/avatar'

const svg = toSvg(${sq(name)}${args})`
    }
  }
}
