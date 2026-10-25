import fse from 'fs-extra'
import { parse } from 'jsonc-parser'
import path from 'node:path'
import { success } from '../../utils/exec.js'

// The harness targets OpenCode 2. This patcher migrates a repository's
// opencode.jsonc from the V1 shape to the native V2 shape, preserving any keys
// it does not know about. V2 reads V1 config in memory, but the harness wants a
// file that is already native so behaviour does not depend on the compatibility
// layer, and the CI merge step requires comment-free JSON.
//
// V1 -> V2 field map this handles:
//   plugin[]            -> plugins[]
//   permissions object  -> ordered permissions[] rules (bash->shell, task->subagent)
//   agent{}             -> agents{} (prompt->system, permission->permissions)
//   skills.paths[]      -> skills[]
//   mcp.<name>          -> mcp.servers.<name> (enabled -> !disabled)
//   compaction.prune    -> removed
//   compaction.reserved -> compaction.buffer
//   experimental.mcp_timeout -> mcp.timeout.{catalog,execution}
//   instructions        -> removed (V2 loads AGENTS.md, not this field)

const CONFIG_SCHEMA = 'https://opencode.ai/config.json'

// Third-party plugins the harness configures, and how they move to V2.
export const OPENCODE_QUOTA_PACKAGE = '@slkiser/opencode-quota'
const OPENCODE_QUOTA_VERSION = '5.0.3'
const OPENCODE_NOTIFIER_PACKAGE = '@mohak34/opencode-notifier'
const OPENCODE_NOTIFIER = `${OPENCODE_NOTIFIER_PACKAGE}@1.1.0`
const DROPPED_PLUGIN_PREFIXES = ['@opencode-ai/', '@different-ai/opencode-browser']

// V1 permission keys -> V2 permission actions.
const ACTION_RENAMES = {
  bash: 'shell',
  task: 'subagent',
  write: 'edit',
  patch: 'edit',
}

function basePackageName(entry) {
  if (typeof entry !== 'string') return ''
  const at = entry.lastIndexOf('@')
  return at > 0 ? entry.slice(0, at) : entry
}

// V1 permission keys that are not V2 permission actions. todowrite is a built-in
// tool allowed by the base policy, so it needs no rule.
const NON_ACTION_PERMISSION_KEYS = new Set(['todowrite'])

function permissionMapToRules(map) {
  const rules = []
  for (const [key, value] of Object.entries(map ?? {})) {
    if (value !== 'allow' && value !== 'deny' && value !== 'ask') continue
    if (NON_ACTION_PERMISSION_KEYS.has(key)) continue
    rules.push({ action: ACTION_RENAMES[key] ?? key, resource: '*', effect: value })
  }
  return rules
}

function upsertRules(existing, additions) {
  const merged = [...existing]
  for (const rule of additions) {
    const index = merged.findIndex(r => r.action === rule.action && r.resource === rule.resource)
    if (index === -1) merged.push(rule)
    else merged[index] = rule
  }
  return merged
}

// V2 keeps every plugin, server and TUI, in `plugins`. The notifier is the one
// third-party plugin the harness wires for everyone; an older pin is upgraded in
// place so a project that opted in does not end up with two notifiers.
function ensureNotifierPlugin(obj) {
  const plugins = Array.isArray(obj.plugins) ? [...obj.plugins] : []
  const index = plugins.findIndex(entry => typeof entry === 'string' && basePackageName(entry) === OPENCODE_NOTIFIER_PACKAGE)
  if (index !== -1 && plugins[index] === OPENCODE_NOTIFIER) return false
  if (index !== -1) plugins[index] = OPENCODE_NOTIFIER
  else plugins.push(OPENCODE_NOTIFIER)
  obj.plugins = plugins
  return true
}

function migratePluginArray(obj) {
  if (!Array.isArray(obj.plugin)) return false
  const plugins = []
  for (const entry of obj.plugin) {
    if (typeof entry !== 'string') {
      plugins.push(entry)
      continue
    }
    const base = basePackageName(entry)
    if (DROPPED_PLUGIN_PREFIXES.some(prefix => base.startsWith(prefix))) continue
    if (base === OPENCODE_QUOTA_PACKAGE) {
      plugins.push(`${OPENCODE_QUOTA_PACKAGE}@${OPENCODE_QUOTA_VERSION}`)
      continue
    }
    plugins.push(entry)
  }
  obj.plugins = plugins
  delete obj.plugin
  return true
}

function migrateAgents(obj) {
  let changed = false
  const agents = { ...(obj.agents ?? {}) }

  if (obj.agent && typeof obj.agent === 'object' && !Array.isArray(obj.agent)) {
    for (const [id, raw] of Object.entries(obj.agent)) {
      if (!raw || typeof raw !== 'object') continue
      const agent = { ...raw }
      if (agent.prompt !== undefined) {
        agent.system = agent.prompt
        delete agent.prompt
      }
      if (agent.disable !== undefined) {
        agent.disabled = agent.disable
        delete agent.disable
      }
      if (agent.permission && typeof agent.permission === 'object') {
        agent.permissions = upsertRules(agent.permissions ?? [], permissionMapToRules(agent.permission))
        delete agent.permission
      }
      delete agent.maxSteps
      agents[id] = agent
    }
    delete obj.agent
    changed = true
  }

  // build and plan are the only primaries; plan is read-only. Guarantee both
  // even when the repo never had an explicit entry.
  const build = { ...(agents.build ?? {}), mode: 'primary' }
  delete build.disabled
  delete build.disable
  if (JSON.stringify(agents.build) !== JSON.stringify(build)) {
    agents.build = build
    changed = true
  }
  const plan = {
    ...(agents.plan ?? {}),
    mode: 'primary',
    permissions: upsertRules(agents.plan?.permissions ?? [], [
      { action: 'edit', resource: '*', effect: 'deny' },
      { action: 'subagent', resource: '*', effect: 'deny' },
    ]),
  }
  delete plan.disabled
  delete plan.disable
  if (JSON.stringify(agents.plan) !== JSON.stringify(plan)) {
    agents.plan = plan
    changed = true
  }

  if (changed) obj.agents = agents
  return changed
}

function migrateMcp(obj) {
  if (!obj.mcp || typeof obj.mcp !== 'object' || Array.isArray(obj.mcp)) return false
  if (obj.mcp.servers) return false
  const servers = {}
  let inheritedTimeout = 300000
  for (const [name, raw] of Object.entries(obj.mcp)) {
    if (!raw || typeof raw !== 'object') continue
    const server = { ...raw }
    if ('enabled' in server) {
      server.disabled = !server.enabled
      delete server.enabled
    }
    if (typeof server.timeout === 'number') {
      inheritedTimeout = server.timeout
      server.timeout = { catalog: server.timeout, execution: server.timeout }
    }
    servers[name] = server
  }
  obj.mcp = {
    servers,
    timeout: { catalog: inheritedTimeout, execution: inheritedTimeout },
  }
  return true
}

/** Mutate `obj` in place to the native V2 shape; returns true when it changed. */
function migrateToV2(obj) {
  let changed = false

  if (obj.$schema !== CONFIG_SCHEMA) {
    obj.$schema = CONFIG_SCHEMA
    changed = true
  }

  if ('instructions' in obj) {
    delete obj.instructions
    changed = true
  }

  if (obj.experimental && typeof obj.experimental === 'object') {
    for (const key of ['openTelemetry', 'batch_tool', 'primary_tools', 'continue_loop_on_deny', 'mcp_timeout']) {
      if (key in obj.experimental) {
        delete obj.experimental[key]
        changed = true
      }
    }
    if (Object.keys(obj.experimental).length === 0) {
      delete obj.experimental
      changed = true
    }
  }

  const compaction = obj.compaction && typeof obj.compaction === 'object' ? { ...obj.compaction } : {}
  if ('prune' in compaction) {
    delete compaction.prune
    changed = true
  }
  if (compaction.auto !== true) {
    compaction.auto = true
    changed = true
  }
  if ('reserved' in compaction) {
    compaction.buffer = compaction.reserved
    delete compaction.reserved
    changed = true
  }
  if (!Number.isFinite(compaction.buffer)) {
    compaction.buffer = 10000
    changed = true
  }
  if (JSON.stringify(obj.compaction) !== JSON.stringify(compaction)) {
    obj.compaction = compaction
    changed = true
  }

  const additions = []
  if (obj.permission && typeof obj.permission === 'object' && !Array.isArray(obj.permission)) {
    additions.push(...permissionMapToRules(obj.permission))
    delete obj.permission
    changed = true
  }
  if (additions.length > 0) {
    const merged = upsertRules(Array.isArray(obj.permissions) ? obj.permissions : [], additions)
    if (JSON.stringify(obj.permissions) !== JSON.stringify(merged)) {
      obj.permissions = merged
      changed = true
    }
  }

  if (obj.skills && typeof obj.skills === 'object' && !Array.isArray(obj.skills)) {
    const paths = Array.isArray(obj.skills.paths) ? obj.skills.paths : []
    obj.skills = paths.includes('.agents/skills') ? paths : [...paths, '.agents/skills']
    changed = true
  } else if (Array.isArray(obj.skills)) {
    if (!obj.skills.includes('.agents/skills')) {
      obj.skills = [...obj.skills, '.agents/skills']
      changed = true
    }
  } else {
    obj.skills = ['.agents/skills']
    changed = true
  }

  if (migrateAgents(obj)) changed = true
  if (migrateMcp(obj)) changed = true
  if (migratePluginArray(obj)) changed = true
  if (ensureNotifierPlugin(obj)) changed = true

  // A session starts read-only: fullstack-engineer is a subagent now, so a
  // default_agent left pointing at it has no valid primary to open with.
  if (obj.default_agent !== 'plan' && obj.default_agent !== 'build') {
    obj.default_agent = 'plan'
    changed = true
  }

  return changed
}

export async function patchOpencodeJson(cwd = process.cwd()) {
  const opencodePath = path.join(cwd, 'opencode.jsonc')

  let text
  if (await fse.pathExists(opencodePath)) {
    text = await fse.readFile(opencodePath, 'utf-8')
  } else {
    text = JSON.stringify({ $schema: CONFIG_SCHEMA }, null, 2)
  }

  const errors = []
  const parsed = parse(text, errors)
  if (errors.length > 0 || typeof parsed !== 'object' || parsed === null) {
    return { patched: false, reason: 'parse error' }
  }

  if (!migrateToV2(parsed)) {
    return { patched: false }
  }

  await fse.writeFile(opencodePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8')
  success('Migrated opencode.jsonc to the native OpenCode 2 shape')
  return { patched: true }
}

// OpenCode 2 plugin packages. @opencode/plugin is the V2 plugin API and carries
// the TUI runtime, so the @opentui peers and solid-js ship with it.
const OPENCODE_PACKAGE_DEPENDENCIES = {
  '@opencode/plugin': '2.0.22',
  '@mohak34/opencode-notifier': '1.1.0',
  '@opentui/core': '0.5.17',
  '@opentui/solid': '0.5.17',
  'solid-js': '1.9.12',
}

const STALE_PACKAGE_DEPENDENCIES = [
  '@opencode-ai/plugin',
  '@different-ai/opencode-browser',
]

// Plugin files earlier harness versions shipped. OpenCode 2 loads every loose
// .js directly under .opencode/plugins/ as a server plugin and discovers a TUI
// entry only from a plugin *directory*, so the old layout both failed to load
// and logged one error per file. `update` installs the new layout alongside
// rather than over it, so the old paths must be removed explicitly.
const SUPERSEDED_PLUGIN_PATHS = [
  '.opencode/plugins/pc-subagent-monitor.js',
  '.opencode/plugins/pc-subagent-monitor.test.js',
  '.opencode/plugins/pc-subagent-tiers.js',
  '.opencode/plugins/pc-subagent-tiers.test.js',
  '.opencode/plugins/pc-subagent-tiers.plugin.js',
  '.opencode/plugins/pc-system-reminders.js',
  '.opencode/plugins/pc-system-reminders.test.js',
  '.opencode/plugins/pc-system-reminders.guard.test.js',
  '.opencode/plugins/pc-system-reminders.plugin.js',
  // The old TUI lived in a shared directory. Remove the harness file itself and
  // leave the directory alone: a project may have put its own TUI plugin there.
  '.opencode/plugins/tui/pc-subagents.tsx',
  '.opencode/tui/pc-subagents.tsx',
]

export async function removeSupersededPlugins(cwd = process.cwd()) {
  const removed = []
  for (const relative of SUPERSEDED_PLUGIN_PATHS) {
    const target = path.join(cwd, relative)
    if (!await fse.pathExists(target)) continue
    await fse.remove(target)
    removed.push(relative)
  }
  if (removed.length > 0) {
    success(`Removed ${removed.length} superseded plugin path(s)`)
  }
  return { removed }
}

export async function patchOpencodePackage(cwd = process.cwd()) {
  const packagePath = path.join(cwd, '.opencode', 'package.json')
  if (!await fse.pathExists(packagePath)) return { patched: false }

  const packageJson = await fse.readJson(packagePath).catch(() => null)
  if (!packageJson?.dependencies) return { patched: false }

  let patched = false

  // The plugin files are ESM; without this Node treats .js as CommonJS.
  if (packageJson.type !== 'module') {
    packageJson.type = 'module'
    patched = true
  }

  for (const [name, version] of Object.entries(OPENCODE_PACKAGE_DEPENDENCIES)) {
    if (packageJson.dependencies[name] === version) continue
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
