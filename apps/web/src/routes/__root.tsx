import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Shell } from '@/components/chrome'
import { SITE } from '@/lib/docs'
import { asset } from '@/lib/site'
import appCss from '../styles.css?url'

const TITLE = '@awflow/avatar · Faces for your agents'
const DESCRIPTION =
  'Deterministic SVG avatars with expressions, agent activities, a wardrobe and a spring-driven rig. Zero runtime dependencies. Built on Peek by Doan Labs, made by AWFlow.'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'theme-color', content: '#1a1918' },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: SITE },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: asset('/favicon.svg'), type: 'image/svg+xml' },
      { rel: 'alternate', type: 'text/plain', href: asset('/llms.txt') },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function NotFound() {
  return (
    <Shell>
      <main className='wrap notfound'>
        <h1 className='h2'>No face here.</h1>
        <p className='lead'>This page does not exist.</p>
        <Link to='/' className='btn btn-accent'>
          Home
        </Link>
      </main>
    </Shell>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang='en'>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
