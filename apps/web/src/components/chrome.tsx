/*
 * The frame every page shares: the sticky header with its mark and nav,
 * and the footer with the credit line and the core's size.
 */

import { ARIA } from '@awflow/avatar/compat'
import { Avatar } from '@awflow/avatar-react'
import { Link, useLocation } from '@tanstack/react-router'
import { type ReactNode, useEffect, useState } from 'react'
import { SiteLink } from '@/components/inline'
import size from '@/generated/size.json'
import { PEEK, REPO } from '@/lib/docs'

// Aria, AWFlow's assistant, is the mark; `style` is not a CSS style here
const { style: _style, ...MARK } = ARIA

export function Mark({ size: px = 28 }: { size?: number }) {
  return <Avatar name='Aria' {...MARK} size={px} square={false} title={false} />
}

const NAV = [
  { label: 'Get started', to: '/docs' },
  { label: 'Themes', to: '/docs/themes' },
  { label: 'API', to: '/docs/api' },
  { label: 'Plugins', to: '/docs/plugins' },
  { label: 'Export', to: '/docs/export' },
  { label: 'Playground', to: '/playground' },
] as const

export function Header() {
  const [open, setOpen] = useState(false)
  const path = useLocation({ select: (l) => l.pathname.replace(/\/$/, '') })
  useEffect(() => setOpen(false), [path])
  return (
    <header className='top'>
      <div className='wrap top-in'>
        <Link to='/' className='brand'>
          <Mark />
          @awflow/avatar
          <span className='badge'>1.0</span>
        </Link>
        <button
          type='button'
          className='menu'
          aria-expanded={open}
          aria-controls='site-nav'
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
        <nav id='site-nav' className='nav' data-open={open} aria-label='Site'>
          {NAV.map((n) => (
            <SiteLink key={n.to} to={n.to}>
              {n.label}
            </SiteLink>
          ))}
          <a href={REPO} target='_blank' rel='noopener'>
            GitHub
          </a>
        </nav>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className='foot'>
      <div className='wrap foot-in'>
        <div className='foot-credit'>
          <Mark size={36} />
          <span>
            MIT · Built on{' '}
            <a href={PEEK} target='_blank' rel='noopener'>
              Peek
            </a>{' '}
            by Doan Labs · Made by AWFlow
          </span>
        </div>
        <span className='foot-size'>{size.kb} KB gzipped · 0 dependencies</span>
      </div>
    </footer>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  )
}
