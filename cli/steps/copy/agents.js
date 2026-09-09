import fse from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { info, success, warn } from '../../utils/exec.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const agentsContent = await fse.readJson(path.resolve(__dirname, '../../presets/agents-content.json'))

// Steps are matched by their title text, not by exact heading string: heading
// level (##/###/####), the `Step N,` prefix and any ` (if Yes)` suffix have all
// drifted before, and every drift silently turned the patch into a no-op that
// only showed up as a warning nobody read.
const HISTORY_STEP_TITLE = 'Archive project history'
const ARCHITECTURE_STEP_TITLE = 'Generate ARCHITECTURE.md'
const DESIGN_STEP_TITLE = 'Generate DESIGN.md'

function stepHeadingPattern(title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^#{2,4}\\s+(?:Step\\s+\\d+[a-z]?[,:]\\s+)?${escaped}\\b`, 'i')
}

// The step heading is kept and its body replaced with an explicit skip note.
// Removing the block and renumbering the remaining steps (the old approach)
// went stale against prose cross-references like "Skip steps 2, 3, and 4";
// stable numbering plus a visible reason is unambiguous for the agent.
export function skipStepBlock(content, title, note) {
  const lines = content.split('\n')
  const pattern = stepHeadingPattern(title)
  const start = lines.findIndex(l => pattern.test(l.trim()))
  if (start === -1) return { content, matched: false }

  // The block ends at the next heading or rule, NOT at end of file. Scanning
  // only for `---` meant a document without one lost everything below the
  // matched step.
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '---' || /^#{1,4}\s/.test(line)) { end = i; break }
  }

  lines.splice(start + 1, end - start - 1, '', `> ${note}`, '')
  return { content: lines.join('\n'), matched: true }
}

const PLATFORM_WORKFLOW_START = '<!-- PC-PLATFORM-WORKFLOW-START -->'
const PLATFORM_WORKFLOW_END = '<!-- PC-PLATFORM-WORKFLOW-END -->'
const PLATFORM_SKILLS_GUIDE_START = '<!-- PC-PLATFORM-SKILLS-GUIDE-START -->'
const PLATFORM_SKILLS_GUIDE_END = '<!-- PC-PLATFORM-SKILLS-GUIDE-END -->'

function platformContent(platform, key) {
  const p = agentsContent.platform[platform] ?? agentsContent.platform.github
  return p[key] ?? ''
}

function mixedPlatformContent(backlogPlatform, repoPlatform, key) {
  if (backlogPlatform === repoPlatform) {
    return platformContent(backlogPlatform, key)
  }
  const backlog = agentsContent.platform[backlogPlatform] ?? agentsContent.platform.github
  const repo = agentsContent.platform[repoPlatform] ?? agentsContent.platform.github
  const mixed = agentsContent.platform.mixed ?? {}
  const mixedKey = `${backlogPlatform}-${repoPlatform}`
  return mixed[mixedKey]?.[key] ?? mixed.default?.[key]?.replace('{backlog}', backlog[key] ?? '').replace('{repo}', repo[key] ?? '') ?? platformContent(repoPlatform, key)
}

function replaceBetween(content, start, end, replacement) {
  if (!content.includes(start) || !content.includes(end)) return content
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`)
  // Replacer function so $&, $' and $` in injected content stay literal.
  return content.replace(pattern, () => `${start}\n${replacement.trim()}\n${end}`)
}

export async function patchAgentsMd(ctx) {
  const obInitSkillPath = path.join(process.cwd(), '.agents', 'skills', 'pc-repo-initialize', 'SKILL.md')
  if (!await fse.pathExists(obInitSkillPath)) return

  let content = await fse.readFile(obInitSkillPath, 'utf-8')
  const patches = []

  const skips = [
    [ctx.hasOpenspec, HISTORY_STEP_TITLE,
      'Skipped during onboarding: this project already had an openspec/ history. Do not archive again; continue with the next step.'],
    [ctx.hasArchitecture, ARCHITECTURE_STEP_TITLE,
      'Skipped during onboarding: ARCHITECTURE.md already exists. Run /make-architecture to regenerate it, which keeps its update mode.'],
    [ctx.hasDesign, DESIGN_STEP_TITLE,
      'Skipped during onboarding: DESIGN.md already exists. Run /make-design to regenerate it, which keeps its update mode.'],
  ]

  for (const [enabled, title, note] of skips) {
    if (!enabled) continue
    const result = skipStepBlock(content, title, note)
    if (!result.matched) {
      warn(`pc-repo-initialize SKILL.md step "${title}" not found: template drift? Skipping this patch.`)
      continue
    }
    content = result.content
    patches.push(`Step "${title}" marked as skipped, file already exists`)
  }

  if (patches.length > 0) {
    await fse.writeFile(obInitSkillPath, content, 'utf-8')
    for (const msg of patches) info(msg)
    success('pc-repo-initialize SKILL.md patched for existing project state')
  }
}

export async function patchAgentGuidance(backlogPlatform, repoPlatform, cwd = process.cwd()) {
  const agentsMdPath = path.join(cwd, 'AGENTS.md')
  if (await fse.pathExists(agentsMdPath)) {
    const repo = repoPlatform ?? backlogPlatform ?? 'github'
    let content = await fse.readFile(agentsMdPath, 'utf-8')
    content = replaceBetween(content, PLATFORM_WORKFLOW_START, PLATFORM_WORKFLOW_END, mixedPlatformContent(backlogPlatform, repo, 'workflow'))
    content = replaceBetween(content, PLATFORM_SKILLS_GUIDE_START, PLATFORM_SKILLS_GUIDE_END, mixedPlatformContent(backlogPlatform, repo, 'skillsGuide'))
    await fse.writeFile(agentsMdPath, `${content.replace(/\s*$/, '')}\n`, 'utf-8')
    const label = backlogPlatform === repo ? repo : `${backlogPlatform}→${repo}`
    success(`AGENTS.md patched for platform workflow: ${label}`)
  }
}


