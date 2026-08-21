import fse from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { info, success } from '../../utils/exec.js'
import { canUpdateManagedFile, readUpdateManifest, recordManagedFile, writeUpdateManifest } from '../../utils/update-manifest.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTENT_SKILLS_DIR = path.resolve(__dirname, '../../content/.agents/skills')
const CONTENT_SKILLS_LOCK = path.resolve(__dirname, '../../content/skills-lock.json')

// Userstory skills parse backlog work items: selected by backlogPlatform only.
// Mixing the two axes here installs the wrong variant on mixed setups, because
// all variants rename to the same generic dir and the first copy wins.
const BACKLOG_PLATFORM_SKILLS = {
  'pc-userstory-gh': 'github',
  'pc-userstory-az': 'azure',
  'pc-userstory-jira': 'jira',
  'pc-userstory-browser': 'browser',
}

// Platform-specific skills are renamed to their generic form on install.
// The -gh / -az / -jira / -gl suffix is only needed here to keep all variants in source.
// After install only one platform is present so no suffix is needed.
export const SKILL_RENAME = {
  'pc-userstory-gh':      'pc-userstory',
  'pc-userstory-az':      'pc-userstory',
  'pc-userstory-jira':    'pc-userstory',
  'pc-userstory-browser': 'pc-userstory',
}

function shouldInstallSkill(skill, backlogPlatform, _repoPlatform) {
  if (skill in BACKLOG_PLATFORM_SKILLS) return BACKLOG_PLATFORM_SKILLS[skill] === backlogPlatform
  return true
}

// Shipped skills whose content is a PLACEHOLDER — a /make-* command
// overwrites them with project-specific content. During forceOverwrite,
// these must be preserved when they have already been generated (detected
// by the <!-- Last updated: marker). Without this check, the update would
// wipe project-specific guardrails, risk assessments, etc.
export const GENERATABLE_SKILLS = new Set([
  'pc-guardrails-project',
  'pc-merge-risk-assess',
])

const MARKER_SKILLS = new Set([
  'pc-guardrails-generic',
  'pc-plan-archive',
  'pc-ops-ship',
  'pc-ops-evidence',
  'pc-repo-initialize',
])

async function isGeneratedSkill(dest) {
  const skillMd = path.join(dest, 'SKILL.md')
  if (!await fse.pathExists(skillMd)) return false
  const content = await fse.readFile(skillMd, 'utf-8')
  return content.includes('<!-- Last updated:')
}

async function syncSkillFiles(src, dest, relativeRoot, cwd, manifest) {
  for (const entry of await fse.readdir(src, { withFileTypes: true })) {
    const sourcePath = path.join(src, entry.name)
    const destinationPath = path.join(dest, entry.name)
    const relativePath = path.join(relativeRoot, entry.name)
    if (entry.isDirectory()) {
      await syncSkillFiles(sourcePath, destinationPath, relativePath, cwd, manifest)
      continue
    }
    if (!await fse.pathExists(destinationPath) || await canUpdateManagedFile(relativePath, cwd, manifest)) {
      await fse.ensureDir(path.dirname(destinationPath))
      await fse.copyFile(sourcePath, destinationPath)
      await recordManagedFile(manifest, relativePath, sourcePath)
      success(`Updated skill: ${relativePath}`)
    } else {
      info(`Preserving modified skill file: ${relativePath}`)
    }
  }
}

async function recordSkillSourceFiles(src, relativeRoot, manifest) {
  for (const entry of await fse.readdir(src, { withFileTypes: true })) {
    const sourcePath = path.join(src, entry.name)
    const relativePath = path.join(relativeRoot, entry.name)
    if (entry.isDirectory()) {
      await recordSkillSourceFiles(sourcePath, relativePath, manifest)
    } else {
      await recordManagedFile(manifest, relativePath, sourcePath)
    }
  }
}

async function installObSkills(backlogPlatform = 'github', repoPlatform, { forceOverwrite = false, updateMode = false } = {}) {
  const repo = repoPlatform ?? backlogPlatform
  const destSkillsDir = path.join(process.cwd(), '.agents', 'skills')
  await fse.ensureDir(destSkillsDir)
  const manifest = await readUpdateManifest()

  // Build the set of skill names we ship (source dirs, after rename).
  // Only these may be removed during forceOverwrite — project-generated
  // skills (pc-merge-risk-assess, custom loops, etc.) must survive.
  const contentSkills = await fse.readdir(CONTENT_SKILLS_DIR)
  const shippedNames = new Set()
  for (const skill of contentSkills) {
    const stat = await fse.stat(path.join(CONTENT_SKILLS_DIR, skill)).catch(() => null)
    if (stat?.isDirectory()) shippedNames.add(SKILL_RENAME[skill] ?? skill)
  }
  // Also account for stale platform-variant names (e.g. pc-userstory-gh
  // when the current platform is azure).
  Object.keys(SKILL_RENAME).forEach(k => shippedNames.add(k))

  if (forceOverwrite && !updateMode) {
    for (const entry of await fse.readdir(destSkillsDir)) {
      if (!entry.startsWith('pc-')) continue
      if (!shippedNames.has(entry)) {
        info(`Preserving project-generated skill: ${entry}`)
        continue
      }
      // Generatable skills: preserve if already populated by /make-*
      if (GENERATABLE_SKILLS.has(entry) && await isGeneratedSkill(path.join(destSkillsDir, entry))) {
        info(`Preserving generated skill: ${entry}`)
        continue
      }
      await fse.remove(path.join(destSkillsDir, entry))
      info(`Removing shipped skill: ${entry}`)
    }
  }

  const skills = contentSkills
  for (const skill of skills) {
    const src = path.join(CONTENT_SKILLS_DIR, skill)
    const destName = SKILL_RENAME[skill] ?? skill
    const dest = path.join(destSkillsDir, destName)
    const stat = await fse.stat(src)
    if (!stat.isDirectory()) continue
    if (!shouldInstallSkill(skill, backlogPlatform, repo)) {
      if (forceOverwrite) {
        const staleDest = path.join(destSkillsDir, skill)
        if (skill !== destName && await fse.pathExists(staleDest)) {
          await fse.remove(staleDest)
          info(`Removing stale skill: ${skill}`)
        }
      }
      info(`Skipping skill: ${skill} (not needed for platforms: ${backlogPlatform}/${repo})`)
      continue
    }
    if (updateMode) {
      if (!await fse.pathExists(dest)) {
        await syncSkillFiles(src, dest, path.join('.agents', 'skills', destName), process.cwd(), manifest)
      } else if (MARKER_SKILLS.has(destName) || GENERATABLE_SKILLS.has(destName)) {
        info(`Preserving project-owned skill: ${destName}`)
      } else {
        await syncSkillFiles(src, dest, path.join('.agents', 'skills', destName), process.cwd(), manifest)
      }
      continue
    }
    if (await fse.pathExists(dest) && !forceOverwrite) {
      info(`${destName} already exists, skipping`)
      continue
    }
    // Even with forceOverwrite, never overwrite an already-generated
    // generatable skill — its content was produced by /make-guardrails or
    // similar, not by the shipped placeholder.
    if (forceOverwrite && GENERATABLE_SKILLS.has(destName) && await isGeneratedSkill(dest)) {
      info(`Preserving generated skill: ${destName}`)
      continue
    }
    await fse.copy(src, dest, { overwrite: true })
    if (!MARKER_SKILLS.has(destName) && !GENERATABLE_SKILLS.has(destName)) {
      await recordSkillSourceFiles(src, path.join('.agents', 'skills', destName), manifest)
    }
    success(`${forceOverwrite ? 'Updated' : 'Installed'} skill: ${destName}`)
  }

  await writeUpdateManifest(manifest)
}

export async function installSkills(backlogPlatform = 'github', repoPlatform, opts = {}) {
  info('Installing built-in pc-skills...')
  await installObSkills(backlogPlatform, repoPlatform, opts)
  console.log()

  if (await fse.pathExists(CONTENT_SKILLS_LOCK)) {
    const destLock = path.join(process.cwd(), 'skills-lock.json')
    if (await fse.pathExists(destLock) && (opts.updateMode || !opts.forceOverwrite)) {
      info('skills-lock.json already exists, skipping')
    } else {
      await fse.copy(CONTENT_SKILLS_LOCK, destLock, { overwrite: true })
      success(`${opts.forceOverwrite ? 'Updated' : 'Installed'} skills-lock.json`)
    }
  }

  // npx skills experimental_install is now called once at the end of the
  // optimization step, after the user has selected which tools to enable.
  // This avoids multiple npx skills add calls during onboarding.
}
