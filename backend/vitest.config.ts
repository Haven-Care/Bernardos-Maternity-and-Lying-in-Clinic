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

    // One file at a time.
    //
    // These are contract tests against a single shared database, not isolated
    // units. With files in parallel, the dashboard suite's agreement checks —
    // "the tile equals what the tab lists" — read stock while the inventory
    // suite is dispensing and restocking it, and fail whenever a write lands
    // between two of the reads. That race existed from the day the dashboard
    // suite was written and simply had not lost yet.
    //
    // Costs a few seconds. Buys a suite whose failures mean something.
    fileParallelism: false,
  },
})
