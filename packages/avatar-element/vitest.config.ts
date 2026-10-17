import { defineConfig } from 'vitest/config'

// happy-dom hosts the elements; the Node import test opts out per file.
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
})
