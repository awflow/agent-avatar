/*
 * The one place registered plugins and themes live. It hangs off
 * `globalThis` under a registered symbol, created once and reused, so two
 * bundles or two installs of the package on a page share one registry: a
 * plugin registered through one copy draws through the other. Every module
 * that keeps registration state reads it from here, never from a local.
 */

import type { Plugin } from './plugins'
import type { Theme } from './themes'

export type Registry = {
  /** Plugins by name, one namespace for every kind but themes. */
  names: Map<string, Exclude<Plugin, { kind: 'theme' }>>
  /** Every registered plugin, in registration order. */
  list: Plugin[]
  /** A frozen copy of `list`, handed out by plugins(). */
  frozen: ReadonlyArray<Plugin>
  /** Plugins already reported as skipped. */
  warned: Set<Plugin>
  /** Custom themes by name (built-ins are never stored here). */
  themes: Map<string, Theme>
  /** What each custom theme was registered from. */
  sources: Map<string, Theme>
  /** One-time development warnings already printed. */
  notes: Set<string>
}

const KEY = Symbol.for('awflow.avatar.registry')

export function registry(): Registry {
  const g = globalThis as { [KEY]?: Registry }
  g[KEY] ??= {
    names: new Map(),
    list: [],
    frozen: Object.freeze([]),
    warned: new Set(),
    themes: new Map(),
    sources: new Map(),
    notes: new Set(),
  }
  return g[KEY]
}

// typed here so the declaration build needs no node types; bundlers replace
// the literal `process.env.NODE_ENV` expression below
declare const process: { env: { NODE_ENV?: string } }

/**
 * True outside production builds. Where `process` does not exist (a browser
 * without a bundler) it reads false: no development warnings there.
 */
export function dev(): boolean {
  try {
    return process.env.NODE_ENV !== 'production'
  } catch {
    return false
  }
}

/** Warns once per key, in development only. */
export function note(key: string, message: string): void {
  if (!dev()) return
  const seen = registry().notes
  if (seen.has(key)) return
  seen.add(key)
  console.warn(`@awflow/avatar: ${message}`)
}
