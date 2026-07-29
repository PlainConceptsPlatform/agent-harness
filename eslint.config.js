import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'docs/.next/**',
      'docs/out/**',
      'src/content/**/node_modules/**',
      'src/content/.opencode/package-lock.json',
      'src/content/**/*.tsx',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js', '*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'array-callback-return': 'error',
      'block-scoped-var': 'error',
      'curly': ['error', 'multi-line'],
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-alert': 'error',
      'no-console': 'off',
      'no-constant-binary-expression': 'error',
      'no-duplicate-imports': 'error',
      'no-else-return': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-implied-eval': 'error',
      'no-lone-blocks': 'error',
      'no-promise-executor-return': 'error',
      'no-return-await': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unneeded-ternary': 'error',
      'no-unreachable-loop': 'error',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
      'object-shorthand': ['error', 'always'],
      'prefer-const': ['error', { destructuring: 'all' }],
      'prefer-template': 'error',
      'require-atomic-updates': 'error'
    }
  },
  {
    files: ['src/**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['src/content/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // The docs site runs in the browser; without browser globals every
    // document/window reference is a false-positive no-undef.
    files: ['docs/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.node,
        fetch: 'readonly',
      },
    },
  },
  {
    files: ['docs/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        fetch: 'readonly',
      },
    },
  }
]
