import fse from 'fs-extra'
import { applyEdits, modify, parse } from 'jsonc-parser'
import path from 'node:path'
import { success } from '../../utils/exec.js'

// The reminder plugin loads every agent ability before work, including
// user-installed skills outside the pc-* and openspec-* namespaces.
const SHARED_PERMISSIONS = [
  ['question', 'allow'],
  ['todowrite', 'allow'],
]

// agent-browser replaced the @different-ai/opencode-browser plugin; any entry
// with that prefix in the plugin array is stale and gets stripped on update.
const STALE_BROWSER_PLUGIN_PREFIX = '@different-ai/opencode-browser'
const AGENT_BROWSER_MCP = {
  type: 'local',
  command: ['agent-browser', 'mcp', '--tools', 'core'],
  enabled: true,
}

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

  // build and plan are overridden, not disabled. Earlier versions disabled them
  // and pointed default_agent at fullstack-engineer; now they are the only two
  // primaries and pc-subagent-tiers regenerates their agent files from
  // fullstack-engineer.md. A repo patched by an earlier version still carries
  // `disable: true`, which would hide both agents, so that flag is cleared here.
  const hasStaleDisable = (
    parsed?.agent?.build?.disable !== undefined ||
    parsed?.agent?.plan?.disable !== undefined
  )
  const needsAgentOverride = hasStaleDisable || !(
    parsed?.agent?.build?.mode === 'primary' &&
    parsed?.agent?.plan?.mode === 'primary' &&
    parsed?.agent?.plan?.permission?.edit === 'deny' &&
    parsed?.agent?.plan?.permission?.task === 'deny'
  )

  // default_agent pointing at fullstack-engineer is now invalid: it became a
  // subagent when build and plan took over as the only primaries, so opencode
  // has no valid default to open a session with. A deliberate choice of build
  // or plan is left alone; anything else is repointed at plan, so a session
  // starts read-only.
  const currentDefault = parsed?.default_agent
  const needsDefaultAgent = currentDefault !== 'plan' && currentDefault !== 'build'
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
  const staleBrowserPlugins = (Array.isArray(parsed?.plugin) ? parsed.plugin : [])
    .filter(entry => typeof entry === 'string' && entry.startsWith(STALE_BROWSER_PLUGIN_PREFIX))
  const needsBrowserMcp = JSON.stringify(parsed?.mcp?.['agent-browser']) !== JSON.stringify(AGENT_BROWSER_MCP)

  if (!needsAgentOverride && !needsDefaultAgent && !needsSkillPermission && missingSharedPermissions.length === 0 && !needsSkillsPaths && !needsCompaction && staleBrowserPlugins.length === 0 && !needsBrowserMcp) {
    return { patched: false }
  }

  // Apply edits sequentially so offsets stay correct
  if (needsAgentOverride) {
    // undefined removes the key, clearing the disable left by earlier versions.
    if (parsed?.agent?.build?.disable !== undefined) {
      text = applyModify(text, ['agent', 'build', 'disable'], undefined)
    }
    if (parsed?.agent?.plan?.disable !== undefined) {
      text = applyModify(text, ['agent', 'plan', 'disable'], undefined)
    }
    text = applyModify(text, ['agent', 'build', 'mode'], 'primary')
    text = applyModify(text, ['agent', 'plan', 'mode'], 'primary')
    text = applyModify(text, ['agent', 'plan', 'permission', 'edit'], 'deny')
    // Read-only has to include spawning: a plan session that can call task()
    // can have a build worker make the change for it.
    text = applyModify(text, ['agent', 'plan', 'permission', 'task'], 'deny')
  }
  if (needsDefaultAgent) {
    text = applyModify(text, ['default_agent'], 'plan')
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

  // Swap the retired opencode-browser plugin for the agent-browser MCP server
  if (staleBrowserPlugins.length > 0) {
    const keptPlugins = parsed.plugin.filter(entry => !staleBrowserPlugins.includes(entry))
    text = applyModify(text, ['plugin'], keptPlugins)
  }
  if (needsBrowserMcp) {
    text = applyModify(text, ['mcp', 'agent-browser'], AGENT_BROWSER_MCP)
  }

  await fse.writeFile(opencodePath, text, 'utf-8')
  if (needsAgentOverride) {
    success('Set build/plan as the primary agents in opencode.jsonc (plan is read-only)')
  }
  if (needsDefaultAgent) {
    success(`default_agent -> plan${currentDefault ? ` (was ${currentDefault})` : ''}`)
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
  if (staleBrowserPlugins.length > 0) {
    success(`Removed ${staleBrowserPlugins.length} stale opencode-browser plugin entr${staleBrowserPlugins.length === 1 ? 'y' : 'ies'} in opencode.jsonc`)
  }
  if (needsBrowserMcp) {
    success('Configured agent-browser MCP server in opencode.jsonc')
  }

  return { patched: true }
}

const OPENCODE_PACKAGE_DEPENDENCIES = {
  '@opencode-ai/plugin': '1.18.19',
  '@opentui/core': '0.5.6',
  '@opentui/solid': '0.5.6',
  'solid-js': '1.9.12',
}

// agent-browser replaced this plugin; remove it from consumer installs on update
const STALE_PACKAGE_DEPENDENCIES = ['@different-ai/opencode-browser']

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
  for (const name of STALE_PACKAGE_DEPENDENCIES) {
    if (!(name in packageJson.dependencies)) continue
    delete packageJson.dependencies[name]
    patched = true
  }
  if (!patched) return { patched: false }

  await fse.writeJson(packagePath, packageJson, { spaces: 2 })
  success('Updated OpenCode plugin dependencies in .opencode/package.json')
  return { patched: true }
}
