import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    // Scope to project source: skip build output and installed agent/plugin scratch
    // dirs (which ship their own *.test.ts using other runners).
    exclude: ['**/node_modules/**', '.next/**', '.agents/**', '.claude/**', '.codex/**', '.design-research/**', '.playwright-mcp/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
