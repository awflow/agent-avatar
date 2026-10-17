import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
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

export default defineConfig({
  plugins: [svelteSsr],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
