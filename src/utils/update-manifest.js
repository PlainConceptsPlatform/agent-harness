import crypto from 'node:crypto'
import fse from 'fs-extra'
import path from 'node:path'

const MANIFEST_RELATIVE_PATH = path.join('.opencode', 'opencode-onboard-managed.json')

function normalizeRelativePath(relativePath) {
  return relativePath.split(path.sep).join('/')
}

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex')
}

export async function hashFile(filePath) {
  return hashContent(await fse.readFile(filePath))
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
  return previousHash === await hashFile(destinationPath)
}

export async function recordManagedFile(manifest, relativePath, sourcePath) {
  const files = manifest.files
  files[normalizeRelativePath(relativePath)] = await hashFile(sourcePath)
}

export function manifestPath() {
  return MANIFEST_RELATIVE_PATH
}
