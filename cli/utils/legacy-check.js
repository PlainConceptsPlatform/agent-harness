import fse from 'fs-extra'
import path from 'node:path'
import { CONFIG_FILE, LEGACY_CONFIG_FILES, OPENCODE_DIR } from './paths.js'

/**
 * Detect a repo onboarded by opencode-onboard v1.x.
 *
 * v2 renamed both the state files and the `ob-` skill prefix, and it does not
 * migrate: see the rename plan. Running against a v1 repo would otherwise fail
 * silently in two places, because `patchFile` returns without logging when its
 * markers are absent and the skill sync only removes stale directories under
 * `forceOverwrite && !updateMode`. The result is a half-patched harness that
 * still reports success, so refuse the run instead.
 */
export async function findLegacyInstall(cwd = process.cwd()) {
  const opencodeDir = path.join(cwd, OPENCODE_DIR)
  if (await fse.pathExists(path.join(opencodeDir, CONFIG_FILE))) return null

  const found = []
  for (const file of LEGACY_CONFIG_FILES) {
    if (await fse.pathExists(path.join(opencodeDir, file))) found.push(`${OPENCODE_DIR}/${file}`)
  }

  const skillsDir = path.join(cwd, '.agents', 'skills')
  const legacySkills = (await fse.readdir(skillsDir).catch(() => []))
    .filter(entry => entry.startsWith('ob-'))

  if (found.length === 0 && legacySkills.length === 0) return null
  return { files: found, skills: legacySkills }
}
