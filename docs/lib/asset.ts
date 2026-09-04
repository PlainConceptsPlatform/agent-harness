/**
 * Prefix a `public/` path with the GitHub Pages basePath.
 *
 * next/link and next/font handle basePath themselves, but next/image skips it
 * when `images.unoptimized` is set (which static export requires), so any
 * public asset referenced by <Image> has to be prefixed explicitly.
 */
export function asset(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`
}
