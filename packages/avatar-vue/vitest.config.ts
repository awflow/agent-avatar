import { defineConfig } from 'vitest/config'

// The workspace runs against src through the private `awflow-src` export
// condition (never `development`, which consumers' dev servers set). Vite's
// default conditions follow it.
const client = ['awflow-src', 'module', 'browser', 'development|production']
const server = ['awflow-src', 'module', 'node', 'development|production']
const src = {
  resolve: { conditions: client },
  ssr: { resolve: { conditions: server } },
}

// Server tests render through vue/server-renderer; client tests hydrate and
// mount in jsdom. One jsdom environment serves both.
export default defineConfig({
  ...src,
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
