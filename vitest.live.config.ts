import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * The live rehearsals: a whole lesson driven through the real models.
 *
 * Separate from the main config because these cost money and need AWS
 * credentials. They exist because every bug that reached the learner —
 * repeated cards, narration with nothing behind it, a JavaScript card holding
 * film dialogue — passed the mocked tests. Mocks prove the wiring; only a real
 * call proves the lesson.
 *
 * Run with: npx vitest run --config vitest.live.config.ts
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/live/**/*.test.ts'],
    testTimeout: 300_000,
    // One lesson at a time: these share a Bedrock throughput quota.
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
