import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import path from 'node:path'

export default defineConfig({
  test: {
    // Match Next's public asset configuration without loading private service credentials.
    env: loadEnv('test', __dirname, 'NEXT_PUBLIC_'),
    environment: 'node',
    include: ['**/*.test.ts'],
    // Scope to project source: skip build output and installed agent/plugin scratch
    // dirs (which ship their own *.test.ts using other runners).
    // scripts/live/** is excluded because it calls the real models: it costs
    // money and needs credentials, so it is run deliberately
    // (`npx vitest run --config vitest.live.config.ts`), never in CI.
    exclude: ['**/node_modules/**', '.next/**', '.agents/**', '.claude/**', '.codex/**', '.design-research/**', '.playwright-mcp/**', 'scripts/live/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
