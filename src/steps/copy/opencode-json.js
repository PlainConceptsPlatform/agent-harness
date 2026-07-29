import fse from 'fs-extra'
import { applyEdits, modify, parse } from 'jsonc-parser'
import path from 'node:path'
import { success } from '../../utils/exec.js'

// Skill loads must never hit an "ask" prompt: /plan-goal and the userstory
// flows load ob-* / openspec-* skills unattended (loop-engineering).
const SHARED_PERMISSIONS = [
  ['question', 'allow'],
  ['todowrite', 'allow'],
]

const SKILL_PERMISSIONS = [
  ['ob-*', 'allow'],
  ['openspec-*', 'allow'],
]

function applyModify(text, jsonPath, value) {
  const edits = modify(text, jsonPath, value, {
    formattingOptions: { insertSpaces: true, tabSize: 2 },
  })
  return applyEdits(text, edits)
}

export async function patchOpencodeJson(cwd = process.cwd()) {
  const opencodePath = path.join(cwd, 'opencode.jsonc')

  let text
  if (await fse.pathExists(opencodePath)) {
    text = await fse.readFile(opencodePath, 'utf-8')
  } else {
    text = JSON.stringify({ $schema: 'https://opencode.ai/config.json' }, null, 2)
  }

  const errors = []
  const parsed = parse(text, errors)
  if (errors.length > 0 || typeof parsed !== 'object') {
    return { patched: false, reason: 'parse error' }
  }

  const needsAgentDisable = !(
    parsed?.agent?.build?.disable === true &&
    parsed?.agent?.plan?.disable === true
  )
  const missingSkillPermissions = SKILL_PERMISSIONS.filter(
    ([pattern, value]) => parsed?.permission?.skill?.[pattern] !== value,
  )
  const missingSharedPermissions = SHARED_PERMISSIONS.filter(
    ([key, value]) => parsed?.permission?.[key] !== value,
  )
  // opencode only scans .opencode/skills/ by default, but we install to .agents/skills/
  const needsSkillsPaths = !(
    Array.isArray(parsed?.skills?.paths) &&
    parsed.skills.paths.includes('.agents/skills')
  )

  if (!needsAgentDisable && missingSkillPermissions.length === 0 && missingSharedPermissions.length === 0 && !needsSkillsPaths) {
    return { patched: false }
  }

  // Apply edits sequentially so offsets stay correct
  if (needsAgentDisable) {
    text = applyModify(text, ['agent', 'build', 'disable'], true)
    text = applyModify(text, ['agent', 'plan', 'disable'], true)
  }
  for (const [pattern, value] of missingSkillPermissions) {
    text = applyModify(text, ['permission', 'skill', pattern], value)
  }
  for (const [key, value] of missingSharedPermissions) {
    text = applyModify(text, ['permission', key], value)
  }

  // Ensure .agents/skills is in skills.paths so opencode discovers installed skills
  if (needsSkillsPaths) {
    const existingPaths = Array.isArray(parsed?.skills?.paths) ? parsed.skills.paths : []
    if (!existingPaths.includes('.agents/skills')) {
      const updatedPaths = [...existingPaths, '.agents/skills']
      text = applyModify(text, ['skills', 'paths'], updatedPaths)
    }
  }

  await fse.writeFile(opencodePath, text, 'utf-8')
  if (needsAgentDisable) {
    success('Disabled built-in build/plan agents in opencode.jsonc')
  }
  if (missingSkillPermissions.length > 0) {
    success('Allowed ob-*/openspec-* skill loading in opencode.jsonc')
  }
  if (missingSharedPermissions.length > 0) {
    success('Allowed question/todowrite tools in opencode.jsonc')
  }
  if (needsSkillsPaths) {
    success('Added .agents/skills to skills.paths in opencode.jsonc')
  }

  return { patched: true }
}
