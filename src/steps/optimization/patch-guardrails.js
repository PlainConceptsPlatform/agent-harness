import fse from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { info, success } from '../../utils/exec.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const GUARDRAILS_FRAGMENT_DIR = path.resolve(__dirname, '../../fragments/guardrails')

const MARKER_SECTIONS = {
  rtk: 'RTK',
  codegraph: 'CODEGRAPH',
  memory: 'MEMORY',
  simpleEnglish: 'SIMPLE-ENGLISH',
  humanizer: 'HUMANIZER',
}

const OPTIONAL_TOOL_GUIDANCE = {
  codegraph: 'Use `codegraph_explore` to refine relevant symbols and file-disjointness for the current wave.',
  memory: 'Use Agentmemory MCP tools for cross-session context and task-result notes.',
}

function replaceMarkerSection(content, startMarker, endMarker, replacement) {
  if (!content.includes(startMarker) || !content.includes(endMarker)) return content
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`${escape(startMarker)}[\\s\\S]*?${escape(endMarker)}`)
  return content.replace(pattern, `${startMarker}\n${replacement}\n${endMarker}`)
}

async function patchOptionalToolGuidance(destSkillsDir, selections) {
  const files = []

  async function collect(dir) {
    for (const entry of await fse.readdir(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) await collect(entryPath)
      else if (entry.name.endsWith('.md')) files.push(entryPath)
    }
  }

  if (!await fse.pathExists(destSkillsDir)) return 0
  await collect(destSkillsDir)

  let patched = 0
  for (const filePath of files) {
    let content = await fse.readFile(filePath, 'utf-8')
    const original = content
    for (const [key, guidance] of Object.entries(OPTIONAL_TOOL_GUIDANCE)) {
      const suffix = key.toUpperCase()
      content = replaceMarkerSection(
        content,
        `<!-- PC-OPTIMIZATION-${suffix}-START -->`,
        `<!-- PC-OPTIMIZATION-${suffix}-END -->`,
        selections[key] ? guidance : '',
      )
    }
    if (content !== original) {
      await fse.writeFile(filePath, `${content.replace(/\s*$/, '')}\n`, 'utf-8')
      patched++
    }
  }
  return patched
}

export async function patchGuardrails(selections = {}, { cwd = process.cwd() } = {}) {
  const destSkillsDir = path.join(cwd, '.agents', 'skills')
  const guardrailsPath = path.join(destSkillsDir, 'pc-guardrails-generic', 'SKILL.md')
  let patchedCount = 0

  if (await fse.pathExists(guardrailsPath)) {
    let content = await fse.readFile(guardrailsPath, 'utf-8')
    content = replaceMarkerSection(
      content,
      '<!-- PC-GUARDRAILS-CAVEMAN-START -->',
      '<!-- PC-GUARDRAILS-CAVEMAN-END -->',
      '',
    ).replace(
      '<!-- PC-GUARDRAILS-CAVEMAN-START -->\n\n<!-- PC-GUARDRAILS-CAVEMAN-END -->',
      '<!-- PC-GUARDRAILS-SIMPLE-ENGLISH-START -->\n<!-- PC-GUARDRAILS-SIMPLE-ENGLISH-END -->',
    ).replace(
      '1. Load ALL skills listed under your own `## Abilities` now (Guardrails first, then the rest), by calling the `skill` tool once per `@skill-name`.',
      '1. The `pc-system-reminders` plugin has already loaded the skills listed under your `## Abilities`, guardrails first.',
    )
    for (const [key, markerSuffix] of Object.entries(MARKER_SECTIONS)) {
      let sectionContent = ''
      if (selections[key]) {
        const presetName = key === 'simpleEnglish' ? 'simple-english' : key
        const presetPath = path.join(GUARDRAILS_FRAGMENT_DIR, `${presetName}.md`)
        if (await fse.pathExists(presetPath)) {
          sectionContent = (await fse.readFile(presetPath, 'utf-8')).trim()
        }
      }
      content = replaceMarkerSection(
        content,
        `<!-- PC-GUARDRAILS-${markerSuffix}-START -->`,
        `<!-- PC-GUARDRAILS-${markerSuffix}-END -->`,
        sectionContent,
      )
      if (selections[key]) patchedCount++
    }
    await fse.writeFile(guardrailsPath, `${content.replace(/\s*$/, '')}\n`, 'utf-8')
  } else {
    info('pc-guardrails-generic not found, skipping guardrails patching')
  }

  const optionalPatched = await patchOptionalToolGuidance(destSkillsDir, selections)
  success(`Guardrails patched: ${patchedCount} sections injected; ${optionalPatched} optional tool file(s) updated`)
  return { patched: true, count: patchedCount, optionalPatched }
}
