import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { compile, preprocess } from 'svelte/compiler'
import { defineConfig } from 'vitest/config'

// Custom transform that compiles .svelte files for SSR (generate: 'server').
// vite-plugin-svelte does not expose a way to force generate: 'server' in test
// mode because it controls that option itself. We compile manually here.
const svelteSsr = {
  name: 'svelte-ssr-test',
  async transform(code: string, id: string) {
    const path = id.split('?')[0]
    if (!path.endsWith('.svelte')) return
    // Run the vitePreprocess preprocessor to strip TypeScript from <script>
    const preprocessed = await preprocess(code, [vitePreprocess()], {
      filename: id,
    })
    const result = compile(preprocessed.code, {
      filename: id,
      generate: 'server',
      dev: false,
    })
    return { code: result.js.code, map: result.js.map }
  },
}

// The workspace runs against src through the private `awflow-src` export
// condition (never `development`, which consumers' dev servers set). Vite's
// default conditions follow it; the client project keeps only browser.
const server = ['awflow-src', 'module', 'node', 'development|production']

// Two projects: the SSR one renders through svelte/server; the client one
// compiles components for the browser and mounts them in jsdom. Client tests
// are `*.test.svelte.ts` so they can hold $state props. Tests live in
// test/, outside src, so svelte-package never ships them.
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [svelteSsr],
        // svelte's server build: no browser condition here
        resolve: { conditions: server },
        ssr: { resolve: { conditions: server } },
        test: {
          name: 'ssr',
          environment: 'jsdom',
          include: ['test/**/*.test.ts'],
        },
      },
      {
        plugins: [svelte({ compilerOptions: { dev: false } })],
        resolve: { conditions: ['awflow-src', 'browser'] },
        ssr: { resolve: { conditions: server } },
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['test/**/*.test.svelte.ts'],
        },
      },
    ],
  },
})
