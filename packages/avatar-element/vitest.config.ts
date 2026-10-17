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

// happy-dom hosts the elements; the Node import test opts out per file.
export default defineConfig({
  ...src,
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
})
