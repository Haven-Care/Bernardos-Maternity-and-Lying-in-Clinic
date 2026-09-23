import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Source only.
    //
    // `tsc -b` emits compiled tests into dist/, and vitest's default glob picks
    // those up too — so every test ran twice, and a test deleted from src/ would
    // keep passing from its stale build output until someone cleaned dist.
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
})
