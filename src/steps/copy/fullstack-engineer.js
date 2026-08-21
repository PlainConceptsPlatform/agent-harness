import fse from 'fs-extra'
import path from 'path'
import { success } from '../../utils/exec.js'

const FULLSTACK_FILE = 'fullstack-engineer.md'
const FULLSTACK_DESCRIPTION = 'Default engineer that accumulates skills from all created persona engineers. Use as fallback when no specialist matches: but prefer spawning a specific engineer for deterministic results.'
const FULLSTACK_IDENTITY = 'You are the default engineer, and your body is what the build and plan agents run. You are more complete but less accurate than specialized engineers, so prefer spawning a specialist when one matches the task domain.'

// The reminder plugin owns ability bootstrap. Remove the old prompt-level
// directive when regenerating so it cannot duplicate the plugin reminder.
function stripStartupDirective(text) {
  if (!text) return text
  return text
    .split(/\r?\n\r?\n+/)
    .filter(paragraph => !paragraph.trim().startsWith('**Startup'))
    .join('\n\n')
    .trim()
}

export async function removeLegacyStartupDirectives({ cwd = process.cwd() } = {}) {
  const agentsDir = path.join(cwd, '.opencode', 'agents')
  if (!await fse.pathExists(agentsDir)) return 0

  let updated = 0
  for (const fileName of await fse.readdir(agentsDir)) {
    if (!fileName.endsWith('.md')) continue
    const filePath = path.join(agentsDir, fileName)
    const content = await fse.readFile(filePath, 'utf-8')
    const cleaned = stripStartupDirective(content)
    if (cleaned === content.trim()) continue
    await fse.writeFile(filePath, `${cleaned}\n`, 'utf-8')
    updated++
  }
  return updated
}

export async function generateFullstackEngineer({ cwd = process.cwd(), updateMode = false } = {}) {
  const agentsDir = path.join(cwd, '.opencode', 'agents')
  await fse.ensureDir(agentsDir)
  const filePath = path.join(agentsDir, FULLSTACK_FILE)

  if (updateMode && await fse.pathExists(filePath)) {
    return { generated: false, preserved: true }
  }

  let existingAbilities = null
  let existingIdentity = null
  if (await fse.pathExists(filePath)) {
    const content = await fse.readFile(filePath, 'utf-8')
    const abilitiesMatch = content.match(/## Abilities\n([\s\S]*?)$/)
    if (abilitiesMatch) existingAbilities = abilitiesMatch[1].trim()
    const identityMatch = content.match(/^---\n[\s\S]*?\n---\n\n(.*?)(?:\n\n## Abilities)/s)
    if (identityMatch) existingIdentity = stripStartupDirective(identityMatch[1])
  }

  const frontmatter = [
    '---',
    `description: ${FULLSTACK_DESCRIPTION}`,
    // subagent, not primary: build.md and plan.md are the primaries, and
    // pc-subagent-tiers generates both from this file on every startup.
    'mode: subagent',
    'color: warning',
    'permission:',
    '  edit: allow',
    '  bash: allow',
    '  read: allow',
    '  glob: allow',
    '  grep: allow',
    '  question: allow',
    '  todowrite: allow',
    '---',
  ]

  const identity = existingIdentity ?? FULLSTACK_IDENTITY

  const abilities = existingAbilities ?? [
    '- Guardrails: @pc-guardrails-generic, @pc-guardrails-project',
  ].join('\n')

  const content = `${frontmatter.join('\n')}\n\n${identity}\n\n## Abilities\n${abilities}\n`

  await fse.writeFile(filePath, content, 'utf-8')
  success(`Generated ${FULLSTACK_FILE}`)
  return { generated: true }
}
