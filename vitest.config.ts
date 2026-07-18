import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts on purpose - keeps the app's build config
// untouched by test-only concerns. Runs in Node (kanaGenerator reads the
// kuromoji dictionary straight from node_modules/kuromoji/dict in this
// environment - see dicPath() in src/utils/kanaGenerator.ts).
export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000,
  },
})
