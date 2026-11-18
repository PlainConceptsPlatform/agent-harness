import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import base from './vitest.config.js'

// The Vitest configuration Stryker runs (stryker.config.json). Stryker's Vitest runner forces the
// threads pool, where process.chdir() is not supported, so the three suites that change directory
// cannot run under it; they still run in CI with every other test. The module only those suites
// cover (cli/commands/shared.js) is left out of `mutate` for the same reason.
export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: [
        ...configDefaults.exclude,
        'cli/commands/shared.test.js',
        'cli/steps/source/source.test.js',
        'cli/steps/clean/clean.test.js',
      ],
    },
  }),
)
