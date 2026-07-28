/**
 * Single source of truth for site-level identity, mirroring Foundations'
 * lib/site.ts.
 *
 * Unlike Foundations this has a real default: the site is a static export to a
 * known GitHub Pages project URL, and `metadataBase` has to be absolute at build
 * time. Override with NEXT_PUBLIC_SITE_URL if it ever moves.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://plainconceptsplatform.github.io/opencode-onboard";

export const siteName = "opencode-onboard";

/** Kept in sync with content/docs/index.mdx frontmatter. */
export const siteDescription =
  "Prepare any codebase for AI. Wires OpenCode, OpenSpec, codegraph, and agentmemory into a multi-agent development workflow powered by native parallel subagents.";

/**
 * The published CLI version, injected at build time from the package manifest by
 * next.config.mjs, so the badge in the nav cannot drift from what npm serves.
 */
export const cliVersion: string = process.env.NEXT_PUBLIC_CLI_VERSION ?? "0.0.0";

/**
 * Join a route onto `siteUrl`.
 *
 * `new URL("/docs", siteUrl)` cannot be used here: siteUrl carries the GitHub
 * Pages project subpath, and an absolute-path input replaces the whole path,
 * silently emitting root-level URLs. Concatenation keeps the subpath.
 */
export function absoluteUrl(path: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
