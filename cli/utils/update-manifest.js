import crypto from 'node:crypto'
import fse from 'fs-extra'
import path from 'node:path'
import { MANIFEST_FILE, OPENCODE_DIR } from './paths.js'

const MANIFEST_RELATIVE_PATH = path.join(OPENCODE_DIR, MANIFEST_FILE)

function normalizeRelativePath(relativePath) {
  return relativePath.split(path.sep).join('/')
}

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex')
}

export async function hashFile(filePath) {
  return hashContent(await fse.readFile(filePath))
}

// A file counts as untouched when it differs from what we shipped only in ways
// the harness itself caused. Two of those, and both made the raw-bytes
// comparison call an untouched file modified — permanently, because the flag is
// re-derived on every update:
//
//   1. Marker pairs. The patchers rewrite them after the copy, so a file with
//      any PC-* marker never matches its own source again.
//   2. Line endings. A file that reaches a consumer's tree through git arrives
//      CRLF on Windows while the shipped source is LF.
//
// This is the general form of the bug that left five repos on a stale
// browser-automation skill through repeated updates.
const MARKER_PAIR = /(<!-- PC-[A-Z0-9-]+-START -->)[\s\S]*?(<!-- PC-[A-Z0-9-]+-END -->)/g

function comparableContent(buffer) {
  return buffer.toString('utf-8').replace(/\r\n/g, '\n').replace(MARKER_PAIR, '$1$2')
}

export async function hashComparableFile(filePath) {
  return hashContent(comparableContent(await fse.readFile(filePath)))
}

export async function readUpdateManifest(cwd = process.cwd()) {
  const manifestPath = path.join(cwd, MANIFEST_RELATIVE_PATH)
  const manifest = await fse.readJson(manifestPath).catch(() => ({ version: 1, files: {} }))
  if (!manifest.files || typeof manifest.files !== 'object') manifest.files = {}
  return manifest
}

export async function writeUpdateManifest(manifest, cwd = process.cwd()) {
  const manifestPath = path.join(cwd, MANIFEST_RELATIVE_PATH)
  await fse.ensureDir(path.dirname(manifestPath))
  await fse.writeJson(manifestPath, manifest, { spaces: 2 })
}

export async function canUpdateManagedFile(relativePath, cwd, manifest) {
  const normalizedPath = normalizeRelativePath(relativePath)
  const destinationPath = path.join(cwd, relativePath)
  if (!await fse.pathExists(destinationPath)) return true
  const previousHash = manifest.files?.[normalizedPath]
  if (!previousHash) return false
  // Raw is accepted too: manifests written before this comparison existed hold
  // raw source hashes, and re-recording them all would need an update to run
  // first, which is the thing being unblocked.
  return previousHash === await hashComparableFile(destinationPath)
    || previousHash === await hashFile(destinationPath)
}

export async function recordManagedFile(manifest, relativePath, sourcePath) {
  const files = manifest.files
  files[normalizeRelativePath(relativePath)] = await hashComparableFile(sourcePath)
}

export function manifestPath() {
  return MANIFEST_RELATIVE_PATH
}
