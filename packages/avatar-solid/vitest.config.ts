import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

// The workspace runs against src through the private `awflow-src` export
// condition (never `development`, which consumers' dev servers set). Vite's
// default conditions follow it.
const client = ['awflow-src', 'module', 'browser', 'development|production']
const server = ['awflow-src', 'module', 'node', 'development|production']

// Two module graphs over the same sources: the server project compiles the
// components for renderToString (solid-js/web's server build), the client
// project compiles them hydratable for the DOM and runs in jsdom.
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [solid({ ssr: true, hot: false })],
        resolve: { conditions: client },
        ssr: { resolve: { conditions: server } },
        test: {
          name: 'ssr',
          environment: 'node',
          include: ['src/**/*.ssr.test.tsx'],
        },
      },
      {
        plugins: [solid({ ssr: true, hot: false })],
        resolve: { conditions: ['awflow-src', 'browser'] },
        ssr: { resolve: { conditions: server } },
        test: {
          name: 'client',
          environment: 'jsdom',
          // one solid-js for the test and solid-js/web, the browser build
          server: { deps: { inline: [/solid-js/] } },
          include: ['src/**/*.client.test.tsx'],
        },
      },
    ],
  },
})
