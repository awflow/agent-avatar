/*
 * /docs: a sidebar and one page at a time, rendered from lib/docs.ts. Every
 * page carries a ready prompt for an agent and its own Markdown, the same
 * text /llms-full.txt serves. On a phone the sidebar folds into a select.
 */
import { Avatar } from '@awflow/avatar-react'
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Shell } from '@/components/chrome'
import { CodeBlock, CopyButton } from '@/components/code-block'
import { FrameworkTabs } from '@/components/framework-tabs'
import { Inline } from '@/components/inline'
import {
  type Block,
  type DocPage,
  PAGES,
  pagePath,
  pageUrl,
  REPO,
  toMarkdown,
  toPrompt,
} from '@/lib/docs'

export const docsHead = (p: DocPage) => {
  const title = `${p.title} · @awflow/avatar`
  const description = `${p.blurb.replaceAll('`', '')} Docs for @awflow/avatar, deterministic SVG avatars.`
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: pageUrl(p) },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
    links: [{ rel: 'canonical', href: pageUrl(p) }],
  }
}

const GROUPS = [...new Set(PAGES.map((p) => p.group))]

function DocLink({ page, children }: { page: DocPage; children: ReactNode }) {
  return page.slug ? (
    <Link
      to='/docs/$slug'
      params={{ slug: page.slug }}
      activeOptions={{ exact: true }}
      activeProps={{ 'aria-current': 'page' }}
    >
      {children}
    </Link>
  ) : (
    <Link
      to='/docs'
      activeOptions={{ exact: true }}
      activeProps={{ 'aria-current': 'page' }}
    >
      {children}
    </Link>
  )
}

function DocsNav() {
  return (
    <nav aria-label='Docs'>
      {GROUPS.map((group) => (
        <div key={group} className='docs-group'>
          <p>{group}</p>
          <ul>
            {PAGES.filter((p) => p.group === group).map((p) => (
              <li key={p.slug}>
                <DocLink page={p}>{p.title}</DocLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className='docs-group'>
        <p>Try it</p>
        <ul>
          <li>
            <Link to='/playground'>Playground</Link>
          </li>
        </ul>
      </div>
      <div className='docs-group'>
        <p>For agents</p>
        <ul>
          {['/llms.txt', '/llms-full.txt'].map((href) => (
            <li key={href}>
              <a href={href}>{href.slice(1)}</a>
            </li>
          ))}
        </ul>
      </div>
      <div className='docs-group'>
        <p>Source</p>
        <ul>
          <li>
            <a href={REPO} target='_blank' rel='noopener'>
              GitHub
            </a>
          </li>
        </ul>
      </div>
    </nav>
  )
}

/* the sidebar on a phone */
function DocsSelect() {
  const path = useLocation({ select: (l) => l.pathname.replace(/\/$/, '') })
  const navigate = useNavigate()
  return (
    <select
      className='docs-select'
      aria-label='Docs page'
      value={path}
      onChange={(e) => navigate({ to: e.target.value })}
    >
      {GROUPS.map((group) => (
        <optgroup key={group} label={group}>
          {PAGES.filter((p) => p.group === group).map((p) => (
            <option key={p.slug} value={pagePath(p)}>
              {p.title}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

export function DocsLayout() {
  return (
    <Shell>
      <div className='wrap docs'>
        <aside className='docs-side'>
          <DocsNav />
        </aside>
        <main style={{ minWidth: 0 }}>
          <DocsSelect />
          <Outlet />
        </main>
      </div>
    </Shell>
  )
}

export function DocsArticle({ page }: { page: DocPage }) {
  const i = PAGES.indexOf(page)
  const prev = PAGES[i - 1]
  const next = PAGES[i + 1]
  return (
    <article className='article'>
      <h1>{page.title}</h1>
      <p className='blurb'>
        <Inline text={page.blurb} />
      </p>
      <div className='doc-actions'>
        <CopyButton
          text={toPrompt(page)}
          label='Copy prompt'
          className='btn btn-dark'
        />
        <CopyButton
          text={toMarkdown(page)}
          label='Copy Markdown'
          className='btn btn-ghost'
        />
      </div>
      {page.blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
      <nav aria-label='Pages' className='pager'>
        {prev ? (
          <PagerLink page={prev} dir='Previous' />
        ) : (
          <span aria-hidden='true' />
        )}
        {next ? <PagerLink page={next} dir='Next' /> : null}
      </nav>
    </article>
  )
}

function PagerLink({ page, dir }: { page: DocPage; dir: 'Previous' | 'Next' }) {
  const body = (
    <>
      <small>{dir}</small>
      <strong>{page.title}</strong>
    </>
  )
  const cls = dir === 'Next' ? 'next' : undefined
  return page.slug ? (
    <Link to='/docs/$slug' params={{ slug: page.slug }} className={cls}>
      {body}
    </Link>
  ) : (
    <Link to='/docs' className={cls}>
      {body}
    </Link>
  )
}

function BlockView({ block: b }: { block: Block }) {
  if (typeof b === 'string')
    return (
      <p>
        <Inline text={b} />
      </p>
    )
  if ('h' in b) {
    const id = b.h.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    return (
      <h2 id={id}>
        <a href={`#${id}`}>{b.h}</a>
      </h2>
    )
  }
  if ('code' in b)
    return <CodeBlock code={b.code} lang={b.lang} title={b.title} />
  if ('frameworks' in b)
    return <FrameworkTabs name={b.frameworks.name} look={b.frameworks.look} />
  if ('list' in b)
    return (
      <ul>
        {b.list.map((t) => (
          <li key={t}>
            <Inline text={t} />
          </li>
        ))}
      </ul>
    )
  if ('rows' in b) {
    const [head = [], ...rows] = b.rows
    return (
      <div className='table-box'>
        <table>
          <thead>
            <tr>
              {head.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>
                    <Inline text={c} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  const size = b.size ?? 88
  return (
    <ul className='faces'>
      {b.faces.map(({ label, ...props }, i) => (
        <li key={i}>
          <Avatar {...props} size={size} />
          {label ? <span>{label}</span> : null}
        </li>
      ))}
    </ul>
  )
}
