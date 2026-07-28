import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

// Served from https://plainconceptsplatform.github.io/opencode-onboard/
// (GitHub Pages project site). Set to '' if the site ever moves to its own domain.
const basePath = '/opencode-onboard'

// The CLI version shown in the nav. Read here rather than imported from
// lib/site.ts: the manifest lives outside this Next project, and webpack parses
// an out-of-scope .json as JavaScript. next.config runs in Node, so fs is fine,
// and the version still has exactly one source of truth.
const cliVersion = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  // GitHub Pages serves directory-style URLs, so every route needs its own
  // index.html rather than a sibling .html file.
  trailingSlash: true,
  basePath,
  // next/link prefixes basePath on its own, but next/image does NOT when
  // images.unoptimized is set, so public/ paths need prefixing by hand.
  // See lib/asset.ts.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_CLI_VERSION: cliVersion,
  },
  images: {
    unoptimized: true,
  },
}

export default withMDX(config)
