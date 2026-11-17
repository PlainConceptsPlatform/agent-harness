import { defineConfig } from 'vitest/config'

// Coverage floors for the CI gate (`pnpm test --coverage` in .github/workflows/ci.yml). They sit
// just under what the suite measured when the gate was added (lines 73.0%, statements 70.5%,
// branches 64.1%, functions 75.4%) and only ever move up: raise them when coverage rises, never
// lower one to go green.
export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['cli/**/*.{js,mjs,cjs}', 'harness/**/*.{js,mjs,cjs}', 'skills/**/*.{js,mjs,cjs}'],
      exclude: ['**/*.test.{js,mjs,cjs}', '**/node_modules/**'],
      reporter: ['text-summary', 'json-summary'],
      thresholds: { lines: 70, statements: 68, branches: 62, functions: 73 },
    },
  },
})
