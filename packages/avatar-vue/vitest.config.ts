import { defineConfig } from 'vitest/config'

// Server tests render through vue/server-renderer; client tests hydrate and
// mount in jsdom. One jsdom environment serves both.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
