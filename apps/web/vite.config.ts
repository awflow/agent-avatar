import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { PAGES } from './src/lib/docs'

/*
 * Static: every page prerenders to HTML, which the root wrangler.jsonc
 * serves as Worker assets. Only listed pages ship, so the site never links
 * to an unfinished one. Auto discovery is off, or every static route would
 * prerender anyway; crawling follows links between listed pages.
 */
const docs = PAGES.map((p) => ({ path: `/docs${p.slug ? `/${p.slug}` : ''}` }))

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: { port: 5174 },
  plugins: [
    tanstackStart({
      prerender: {
        enabled: true,
        crawlLinks: true,
        autoStaticPathsDiscovery: false,
      },
      pages: [
        { path: '/' },
        { path: '/playground' },
        ...docs,
        { path: '/llms.txt' },
        { path: '/llms-full.txt' },
      ],
    }),
    viteReact(),
  ],
})
