/*
 * Where the site lives. The build reads two env vars:
 *
 * - `SITE_BASE`: the path the site is served under, `/agent-avatar/` on
 *   GitHub Pages. Unset, the build serves from `/` (local dev).
 * - `SITE_ORIGIN`: the origin for canonical and og URLs and the links in
 *   /llms.txt. Defaults to `https://awflow.github.io`.
 *
 * Canonical URLs always name the published site: with `SITE_BASE` unset they
 * still point at `/agent-avatar`, so a local build never writes localhost
 * into /llms.txt.
 */
export const PAGES_ORIGIN = 'https://awflow.github.io'
export const PAGES_BASE = '/agent-avatar/'

/** `x`, `/x`, `x/` and `/x/` all become `/x/`; empty becomes `/`. */
export const normalizeBase = (base: string) =>
  `/${base.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/')

export function siteConfig(env: Record<string, string | undefined>) {
  const base = normalizeBase(env.SITE_BASE ?? '/')
  const origin = (env.SITE_ORIGIN || PAGES_ORIGIN).replace(/\/+$/, '')
  const path = env.SITE_BASE ? base : PAGES_BASE
  return { base, site: `${origin}${path.replace(/\/$/, '')}` }
}

/** A path under the site's base: `asset('/favicon.svg')`. */
export const asset = (path: string) =>
  `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`
