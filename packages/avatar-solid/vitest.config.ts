import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

// Two module graphs over the same sources: the server project compiles the
// components for renderToString (solid-js/web's server build), the client
// project compiles them hydratable for the DOM and runs in jsdom.
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [solid({ ssr: true, hot: false })],
        test: {
          name: 'ssr',
          environment: 'node',
          include: ['src/**/*.ssr.test.tsx'],
        },
      },
      {
        plugins: [solid({ ssr: true, hot: false })],
        resolve: { conditions: ['browser'] },
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
