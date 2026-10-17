import { defineConfig } from 'vitest/config'

// Server tests render through react-dom/server; client tests hydrate and
// mount in jsdom. One jsdom environment serves both.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
