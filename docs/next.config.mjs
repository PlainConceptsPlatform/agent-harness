import { readFileSync } from 'node:fs'
import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

// Served from https://plainconceptsplatform.github.io/opencode-onboard/
// (GitHub Pages project site). Set to '' if the site ever moves to its own domain.
const basePath = '/opencode-onboard'

const PACKAGE_NAME = '@plainconceptsplatform/opencode-onboard'

/**
 * The version shown in the nav, taken from the npm registry rather than the repo
 * manifest: the manifest says what will be published next, npm says what people
 * can actually install today, and those diverge between a bump and a release.
 *
 * Resolved at build time so the static export needs no client-side request. The
 * manifest is the fallback, with a timeout, so a slow or offline registry cannot
 * break or stall the build.
 */
async function resolveVersion() {
  const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ).version

  try {
    const response = await fetch(
      `https://registry.npmjs.org/${PACKAGE_NAME.replace('/', '%2F')}`,
      { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } },
    )
    if (!response.ok) throw new Error(`registry responded ${response.status}`)

    const published = (await response.json())['dist-tags']?.latest
    if (typeof published === 'string' && published.length > 0) return published

    throw new Error('registry returned no dist-tags.latest')
  } catch (error) {
    console.warn(
      `[docs] could not read the published version of ${PACKAGE_NAME} (${error.message}); ` +
        `falling back to the manifest version ${manifest}`,
    )
    return manifest
  }
}

const cliVersion = await resolveVersion()

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
