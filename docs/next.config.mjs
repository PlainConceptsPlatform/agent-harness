import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

// Served from https://plainconceptsplatform.github.io/opencode-onboard/
// (GitHub Pages project site). Set to '' if the site ever moves to its own domain.
const basePath = '/opencode-onboard'

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
  },
  images: {
    unoptimized: true,
  },
}

export default withMDX(config)
