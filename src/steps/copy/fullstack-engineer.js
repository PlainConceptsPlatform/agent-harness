import fse from 'fs-extra'
import path from 'path'
import { success } from '../../utils/exec.js'

const FULLSTACK_FILE = 'fullstack-engineer.md'
const FULLSTACK_DESCRIPTION = 'Default engineer that accumulates skills from all created persona engineers. Use as fallback when no specialist matches: but prefer spawning a specific engineer for deterministic results.'
const FULLSTACK_IDENTITY = 'You are the default engineer, mostly used by the user for architecture and planning. You are more complete but less accurate than specialized engineers, prefer spawning a specialist when one matches the task domain.'

// Abilities are just text in the prompt: OpenCode does not auto-load them. This
// directive forces the agent to eagerly load every skill it lists (guardrails
// first) at session/spawn start, instead of lazily only when a task matches.
const STARTUP_DIRECTIVE = '**Startup — before doing anything else:** load every skill listed under `## Abilities` by calling the `skill` tool once per `@skill-name` (Guardrails first). These are mandatory instructions to read and apply, not passive references.'

// Drop any previously emitted startup directive so regeneration re-emits a
// single canonical copy instead of stacking duplicates.
function stripStartupDirective(text) {
  if (!text) return text
  return text
    .split(/\n\n+/)
    .filter(paragraph => !paragraph.trim().startsWith('**Startup'))
    .join('\n\n')
    .trim()
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
    'mode: primary',
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
    '- Guardrails: @ob-guardrails-generic, @ob-guardrails-project',
  ].join('\n')

  const content = `${frontmatter.join('\n')}\n\n${identity}\n\n${STARTUP_DIRECTIVE}\n\n## Abilities\n${abilities}\n`

  await fse.writeFile(filePath, content, 'utf-8')
  success(`Generated ${FULLSTACK_FILE}`)
  return { generated: true }
}
