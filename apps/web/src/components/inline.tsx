/*
 * Docs prose: backticks become code, [text](href) becomes a link (a site
 * path through the router, anything else in a new tab), the rest is text.
 */
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

/** A link to a site path; `/docs/<slug>` goes through the docs route. */
export function SiteLink({
  to,
  className,
  children,
}: {
  to: string
  className?: string
  children: ReactNode
}) {
  const doc = /^\/docs\/([\w-]+)$/.exec(to)
  if (doc)
    return (
      <Link
        to='/docs/$slug'
        params={{ slug: doc[1]! }}
        className={className}
        activeOptions={{ exact: true }}
        activeProps={{ 'aria-current': 'page' }}
      >
        {children}
      </Link>
    )
  return (
    <Link
      to={to as '/'}
      className={className}
      activeOptions={{ exact: true }}
      activeProps={{ 'aria-current': 'page' }}
    >
      {children}
    </Link>
  )
}

const PART = /(`[^`]+`|\[[^\]]+\]\([^)]+\))/g

export function Inline({ text }: { text: string }) {
  return text.split(PART).map((s, i) => {
    if (!s) return null
    if (s.startsWith('`') && s.endsWith('`'))
      return <code key={i}>{s.slice(1, -1)}</code>
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(s)
    if (link) {
      const [, label, href] = link
      return href!.startsWith('/') ? (
        <SiteLink key={i} to={href!}>
          {label}
        </SiteLink>
      ) : (
        <a key={i} href={href} target='_blank' rel='noopener'>
          {label}
        </a>
      )
    }
    return s
  })
}

/** The text without its Markdown: for labels set in mono. */
export const plain = (text: string) =>
  text.replaceAll('`', '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
