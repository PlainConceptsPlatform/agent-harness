import fse from 'fs-extra'
import path from 'path'

// Folders never copied (skills handled separately by installSkills, .bootstrap is internal tooling)
const ALWAYS_EXCLUDE = ['.bootstrap', 'skills', 'node_modules']

// Files never overwritten even with forceOverwrite: user owns these.
// The CLI ships templates, but init / the wizard / the user populate them
// with project-specific content. Overwriting on update would destroy user work.
const NEVER_OVERWRITE = [
  `openspec${path.sep}config.yaml`,
  'opencode.jsonc',
]

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
 * @param {{ hasDesign?: boolean, hasArchitecture?: boolean }} ctx
 */
export async function copyContent(contentDir, destDir, platform, ctx = {}) {
  await fse.copy(contentDir, destDir, {
    overwrite: ctx.forceOverwrite ?? false,
    filter: (src) => {
      const rel = path.relative(contentDir, src)
      const parts = rel.split(path.sep)
      if (parts.some(part => ALWAYS_EXCLUDE.includes(part))) return false
      if (ctx.hasDesign && rel === 'DESIGN.md') return false
      if (ctx.hasArchitecture && rel === 'ARCHITECTURE.md') return false
      // User-owned config files are never overwritten, even with forceOverwrite.
      // The update command calls writeModelsToConfigs separately to set the
      // model field in opencode.jsonc without destroying user additions.
      if (NEVER_OVERWRITE.includes(rel)) return false
      return true
    },
  })
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
