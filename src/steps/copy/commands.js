import fse from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { success } from '../../utils/exec.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const _archive = {
  azure: await fse.readFile(path.resolve(__dirname, '../../fragments/archive/az.md'), 'utf-8'),
  github: await fse.readFile(path.resolve(__dirname, '../../fragments/archive/gh.md'), 'utf-8'),
  gitlab: await fse.readFile(path.resolve(__dirname, '../../fragments/archive/gl.md'), 'utf-8'),
  none: await fse.readFile(path.resolve(__dirname, '../../fragments/archive/none.md'), 'utf-8'),
}

const _ship = {
  github: await fse.readFile(path.resolve(__dirname, '../../fragments/ops-ship/gh.md'), 'utf-8'),
  azure: await fse.readFile(path.resolve(__dirname, '../../fragments/ops-ship/az.md'), 'utf-8'),
  gitlab: await fse.readFile(path.resolve(__dirname, '../../fragments/ops-ship/gl.md'), 'utf-8'),
}

const _review = {
  github: await fse.readFile(path.resolve(__dirname, '../../fragments/ops-review/gh.md'), 'utf-8'),
  azure: await fse.readFile(path.resolve(__dirname, '../../fragments/ops-review/az.md'), 'utf-8'),
  gitlab: await fse.readFile(path.resolve(__dirname, '../../fragments/ops-review/gl.md'), 'utf-8'),
}

const _backlog = {
  github: await fse.readFile(path.resolve(__dirname, '../../fragments/ops-backlog/gh.md'), 'utf-8'),
  azure: await fse.readFile(path.resolve(__dirname, '../../fragments/ops-backlog/az.md'), 'utf-8'),
  jira: await fse.readFile(path.resolve(__dirname, '../../fragments/ops-backlog/jira.md'), 'utf-8'),
}

// Evidence comments target the backlog platform (where the issue/work-item lives).
const _evidence = {
  github: await fse.readFile(path.resolve(__dirname, '../../fragments/ops-evidence/gh.md'), 'utf-8'),
  azure: await fse.readFile(path.resolve(__dirname, '../../fragments/ops-evidence/az.md'), 'utf-8'),
  jira: await fse.readFile(path.resolve(__dirname, '../../fragments/ops-evidence/jira.md'), 'utf-8'),
}

// relativePath is POSIX-style relative to the project root; commands live in
// .opencode/commands/, skill-backed procedures (plan-archive, ops-ship) in
// .agents/skills/<name>/SKILL.md.
function patchFile(relativePath, startMarker, endMarker, content, platform, cwd = process.cwd()) {
  const targetPath = path.join(cwd, ...relativePath.split('/'))
  if (!fse.pathExistsSync(targetPath)) return

  let fileContent = fse.readFileSync(targetPath, 'utf-8')
  if (!fileContent.includes(startMarker) || !fileContent.includes(endMarker)) return

  const pattern = new RegExp(`${startMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${endMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  // Replacer function, not a replacement string: the injected fragments contain
  // shell quoting like $'...' and a string replacement expands $' as "everything
  // after the match", silently truncating the command. That is how the ops-ship
  // screenshot comment lost its entire --body argument.
  fileContent = fileContent.replace(pattern, () => `${startMarker}\n${content.trim()}\n${endMarker}`)
  fse.writeFileSync(targetPath, `${fileContent.replace(/\s*$/, '')}\n`, 'utf-8')
  success(`${relativePath} content injected for platform: ${platform}`)
}

export async function patchArchiveCommand(platform, cwd = process.cwd()) {
  const repoPlatform = typeof platform === 'object' ? (platform.repoPlatform ?? platform.backlogPlatform ?? 'github') : platform
  const replacement = _archive[repoPlatform]
  if (!replacement) return
  patchFile('.agents/skills/pc-plan-archive/SKILL.md', '<!-- PC-PLATFORM-ARCHIVE-START -->', '<!-- PC-PLATFORM-ARCHIVE-END -->', replacement, repoPlatform, cwd)
}

export async function patchOpsShip(platform, cwd = process.cwd()) {
  const repoPlatform = typeof platform === 'object' ? (platform.repoPlatform ?? 'github') : platform
  const replacement = _ship[repoPlatform]
  if (!replacement) return
  patchFile('.agents/skills/pc-ops-ship/SKILL.md', '<!-- PC-PLATFORM-SHIP-START -->', '<!-- PC-PLATFORM-SHIP-END -->', replacement, repoPlatform, cwd)
}

export async function patchOpsReview(platform, cwd = process.cwd()) {
  const repoPlatform = typeof platform === 'object' ? (platform.repoPlatform ?? 'github') : platform
  const replacement = _review[repoPlatform]
  if (!replacement) return
  patchFile('.opencode/commands/ops-review.md', '<!-- PC-PLATFORM-REVIEW-START -->', '<!-- PC-PLATFORM-REVIEW-END -->', replacement, repoPlatform, cwd)
}

export async function patchOpsBacklog(platform, cwd = process.cwd()) {
  const backlogPlatform = typeof platform === 'object' ? (platform.backlogPlatform ?? 'github') : platform
  const replacement = _backlog[backlogPlatform]
  if (!replacement) return
  patchFile('.opencode/commands/ops-backlog.md', '<!-- PC-PLATFORM-BACKLOG-START -->', '<!-- PC-PLATFORM-BACKLOG-END -->', replacement, backlogPlatform, cwd)
}

export async function patchOpsEvidence(platform, cwd = process.cwd()) {
  const backlogPlatform = typeof platform === 'object' ? (platform.backlogPlatform ?? 'github') : platform
  const replacement = _evidence[backlogPlatform]
  // browser/none have no CLI to post with: leave the markers empty (the skill skips commenting).
  if (!replacement) return
  patchFile('.agents/skills/pc-ops-evidence/SKILL.md', '<!-- PC-PLATFORM-EVIDENCE-START -->', '<!-- PC-PLATFORM-EVIDENCE-END -->', replacement, backlogPlatform, cwd)
}

