import fse from 'fs-extra'
import { applyEdits, modify, parse } from 'jsonc-parser'
import path from 'node:path'
import { success } from '../../utils/exec.js'

// The reminder plugin loads every agent ability before work, including
// user-installed skills outside the ob-* and openspec-* namespaces.
const SHARED_PERMISSIONS = [
  ['question', 'allow'],
  ['todowrite', 'allow'],
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
  const needsSkillPermission = parsed?.permission?.skill !== 'allow'
  const missingSharedPermissions = SHARED_PERMISSIONS.filter(
    ([key, value]) => parsed?.permission?.[key] !== value,
  )
  // opencode only scans .opencode/skills/ by default, but we install to .agents/skills/
  const needsSkillsPaths = !(
    Array.isArray(parsed?.skills?.paths) &&
    parsed.skills.paths.includes('.agents/skills')
  )
  const needsCompaction = !(
    parsed?.compaction?.auto === true &&
    parsed?.compaction?.prune === true
  )

  if (!needsAgentDisable && !needsSkillPermission && missingSharedPermissions.length === 0 && !needsSkillsPaths && !needsCompaction) {
    return { patched: false }
  }

  // Apply edits sequentially so offsets stay correct
  if (needsAgentDisable) {
    text = applyModify(text, ['agent', 'build', 'disable'], true)
    text = applyModify(text, ['agent', 'plan', 'disable'], true)
  }
  if (needsSkillPermission) text = applyModify(text, ['permission', 'skill'], 'allow')
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

  // Enable context pruning to reduce token costs in long agent sessions
  if (needsCompaction) {
    text = applyModify(text, ['compaction', 'auto'], true)
    text = applyModify(text, ['compaction', 'prune'], true)
    text = applyModify(text, ['compaction', 'reserved'], 10000)
  }

  await fse.writeFile(opencodePath, text, 'utf-8')
  if (needsAgentDisable) {
    success('Disabled built-in build/plan agents in opencode.jsonc')
  }
  if (needsSkillPermission) {
    success('Allowed skill loading in opencode.jsonc')
  }
  if (missingSharedPermissions.length > 0) {
    success('Allowed question/todowrite tools in opencode.jsonc')
  }
  if (needsSkillsPaths) {
    success('Added .agents/skills to skills.paths in opencode.jsonc')
  }
  if (needsCompaction) {
    success('Enabled context pruning (compaction.prune) in opencode.jsonc')
  }

  return { patched: true }
}

const OPENCODE_PACKAGE_DEPENDENCIES = {
  '@opencode-ai/plugin': '1.18.19',
  '@opentui/core': '0.5.6',
  '@opentui/solid': '0.5.6',
  'solid-js': '1.9.12',
}

export async function patchOpencodePackage(cwd = process.cwd()) {
  const packagePath = path.join(cwd, '.opencode', 'package.json')
  if (!await fse.pathExists(packagePath)) return { patched: false }

  const packageJson = await fse.readJson(packagePath).catch(() => null)
  if (!packageJson?.dependencies) return { patched: false }

  let patched = false
  for (const [name, version] of Object.entries(OPENCODE_PACKAGE_DEPENDENCIES)) {
    if (!(name in packageJson.dependencies) || packageJson.dependencies[name] === version) continue
    packageJson.dependencies[name] = version
    patched = true
  }
  if (!patched) return { patched: false }

  await fse.writeJson(packagePath, packageJson, { spaces: 2 })
  success('Updated OpenCode plugin dependencies in .opencode/package.json')
  return { patched: true }
}
