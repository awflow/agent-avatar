import { readFileSync } from 'node:fs'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { PAGES } from './src/lib/docs.ts'
import { siteConfig } from './src/lib/site.ts'

/*
 * Static: every page prerenders to `path/index.html` under dist/client, which
 * GitHub Pages serves as is (.github/workflows/pages.yml). Only listed pages
 * ship, so the site never links to an unfinished one. Auto discovery is off,
 * or every static route would prerender anyway; crawling follows links
 * between listed pages. `SITE_BASE` sets the path it is served under (the
 * router basepath follows Vite's `base`); see src/lib/site.ts.
 */
const { base, site } = siteConfig(process.env)
// listed under the base, so the crawler's links match and nothing renders twice
const at = (path: string) => ({ path: `${base}${path}` })
const docs = PAGES.map((p) => at(`docs${p.slug ? `/${p.slug}` : ''}`))

/** GitHub Pages extras: a static 404 page under the base, and no Jekyll. */
function pages(): Plugin {
  return {
    name: 'awflow:pages',
    apply: 'build',
    applyToEnvironment: (env) => env.name === 'client',
    generateBundle() {
      const html = readFileSync(
        new URL('./src/404.html', import.meta.url),
        'utf8',
      )
      this.emitFile({
        type: 'asset',
        fileName: '404.html',
        source: html.replaceAll('%BASE%', base),
      })
      this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' })
    },
  }
}

export default defineConfig({
  base,
  define: { __SITE__: JSON.stringify(site) },
  resolve: { tsconfigPaths: true },
  server: { port: 5174 },
  plugins: [
    tanstackStart({
      prerender: {
        enabled: true,
        crawlLinks: true,
        autoStaticPathsDiscovery: false,
        autoSubfolderIndex: true,
      },
      pages: [
        at(''),
        at('playground'),
        ...docs,
        at('llms.txt'),
        at('llms-full.txt'),
      ],
    }),
    viteReact(),
    pages(),
  ],
})
