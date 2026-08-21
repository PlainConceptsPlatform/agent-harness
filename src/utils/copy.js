import fse from 'fs-extra'
import path from 'path'
import { canUpdateManagedFile, hashFile, readUpdateManifest, recordManagedFile, writeUpdateManifest } from './update-manifest.js'

// Folders never copied (skills handled separately by installSkills, .bootstrap is internal tooling)
const ALWAYS_EXCLUDE = ['.bootstrap', 'skills', 'node_modules']

// Files never overwritten even with forceOverwrite: user owns these.
// The CLI ships templates, but init / the wizard / the user populate them
// with project-specific content. Overwriting on update would destroy user work.
const NEVER_OVERWRITE = [
  `openspec${path.sep}config.yaml`,
  'opencode.jsonc',
]

const MARKER_COMMANDS = new Set(['.opencode/commands/ops-review.md', '.opencode/commands/ops-backlog.md'])

function isTemplateTest(relativePath) {
  return relativePath.split(path.sep).join('/').startsWith('.opencode/plugins/') && relativePath.endsWith('.test.js')
}

export function isManagedContentPath(relativePath) {
  const normalized = relativePath.split(path.sep).join('/')
  if (normalized.startsWith('.opencode/plugins/')) return true
  if (normalized === '.opencode/tui/pc-subagents.tsx') return true
  if (normalized.startsWith('.opencode/commands/') && !MARKER_COMMANDS.has(normalized)) return true
  return normalized === 'openspec/specs/.gitkeep' || normalized === 'openspec/changes/archive/.gitkeep'
}

/**
 * Copy content/ directory to destination.
 * Excludes:
 *   - .agents/skills and .opencode/skills (handled separately)
 *   - .bootstrap (internal tooling)
 *   - node_modules
 *   - DESIGN.md and ARCHITECTURE.md if ctx says they already exist (preserve user's files)
 * @param {string} contentDir - absolute path to content/
 * @param {string} destDir - absolute path to destination (project root)
 * @param {'azure'|'github'} platform
 * @param {{ hasDesign?: boolean, hasArchitecture?: boolean, updateMode?: boolean }} ctx
 */
export async function copyContent(contentDir, destDir, platform, ctx = {}) {
  const manifest = ctx.updateMode ? await readUpdateManifest(destDir) : null
  await fse.copy(contentDir, destDir, {
    overwrite: ctx.updateMode || ctx.forceOverwrite || false,
    filter: async (src) => {
      const rel = path.relative(contentDir, src)
      const parts = rel.split(path.sep)
      if (parts.some(part => ALWAYS_EXCLUDE.includes(part))) return false
      if (isTemplateTest(rel)) return false
      if (ctx.hasDesign && rel === 'DESIGN.md') return false
      if (ctx.hasArchitecture && rel === 'ARCHITECTURE.md') return false
      // User-owned config files are never overwritten, even with forceOverwrite.
      // The update command calls writeModelsToConfigs separately to set the
      // model field in opencode.jsonc without destroying user additions.
      if (NEVER_OVERWRITE.includes(rel)) return false
      if (!ctx.updateMode) return true

      const stat = await fse.stat(src)
      if (stat.isDirectory()) return true
      if (!isManagedContentPath(rel)) {
        return !(await fse.pathExists(path.join(destDir, rel)))
      }
      return canUpdateManagedFile(rel, destDir, manifest)
    },
  })
}

export async function recordManagedContent(contentDir, destDir, { updateMode = false } = {}) {
  const manifest = await readUpdateManifest(destDir)

  async function walk(directory) {
    for (const entry of await fse.readdir(directory, { withFileTypes: true })) {
      const sourcePath = path.join(directory, entry.name)
      const relativePath = path.relative(contentDir, sourcePath)
      if (entry.isDirectory()) {
        await walk(sourcePath)
        continue
      }
      if (isTemplateTest(relativePath)) continue
      if (!isManagedContentPath(relativePath)) continue

      const destinationPath = path.join(destDir, relativePath)
      if (!await fse.pathExists(destinationPath)) continue
      const sourceHash = await hashFile(sourcePath)
      const destinationHash = await hashFile(destinationPath)
      const manifestPath = relativePath.split(path.sep).join('/')
      const previousHash = manifest.files?.[manifestPath]
      if (!updateMode || destinationHash === sourceHash || destinationHash === previousHash) {
        await recordManagedFile(manifest, relativePath, sourcePath)
      }
    }
  }

  await walk(contentDir)
  await writeUpdateManifest(manifest, destDir)
}

export async function findAiFiles(dir, files) {
  const found = []
  for (const file of files) {
    const fullPath = path.join(dir, file)
    if (await fse.pathExists(fullPath)) {
      found.push(fullPath)
    }
  }
  return found
}
