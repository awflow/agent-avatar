import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [svelte()],
  // the preview runs on the workspace src (the private awflow-src condition)
  resolve: {
    conditions: ['awflow-src', 'module', 'browser', 'development|production'],
  },
  root: 'preview',
})
