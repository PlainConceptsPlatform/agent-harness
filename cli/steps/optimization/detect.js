import fse from 'fs-extra'
import path from 'node:path'
import { parse } from 'jsonc-parser'

/**
 * Work out which optional tools a project actually has, rather than trusting
 * the flags in harness.json.
 *
 * Those flags drift. Numa and Odissey both had codegraph and agentmemory MCP
 * servers enabled in opencode.jsonc and the humanizer and simple-english skills
 * installed, while harness.json recorded `codegraph: false`, `memory: false` and
 * no humanizer key at all. patchGuardrails believed the config and emptied those
 * marker sections, so agents lost the guidance for tools the project was running.
 *
 * Detection only ever turns a tool ON. A flag that is already true is left
 * alone, because some of these install globally and cannot be seen from inside
 * the repository at all.
 */

function mcpServers(cwd) {
  const configPath = path.join(cwd, 'opencode.jsonc')
  if (!fse.pathExistsSync(configPath)) return {}
  const errors = []
  const parsed = parse(fse.readFileSync(configPath, 'utf-8'), errors)
  if (errors.length > 0 || typeof parsed !== 'object' || parsed === null) return {}
  return parsed.mcp ?? {}
}

function hasSkill(cwd, name) {
  return fse.pathExistsSync(path.join(cwd, '.agents', 'skills', name))
}

/** An MCP server counts as present unless it is explicitly disabled. */
function hasMcp(servers, name) {
  const server = servers[name]
  if (!server) return false
  return server.enabled !== false
}

export function detectInstalledTools(cwd = process.cwd()) {
  const servers = mcpServers(cwd)
  return {
    // rtk is a global CLI with nothing to find in the repo, so it is not
    // detectable here and the saved flag stands on its own.
    codegraph: hasMcp(servers, 'codegraph') || fse.pathExistsSync(path.join(cwd, '.codegraph')),
    memory: hasMcp(servers, 'agentmemory'),
    simpleEnglish: hasSkill(cwd, 'simple-english'),
    humanizer: hasSkill(cwd, 'humanizer'),
    quota: fse.pathExistsSync(path.join(cwd, '.opencode', 'opencode-quota')),
  }
}

/**
 * Saved flags merged with what is on disk. Detection can only add, so a tool
 * recorded as enabled stays enabled even when nothing local proves it.
 */
export function reconcileTools(saved = {}, cwd = process.cwd()) {
  const detected = detectInstalledTools(cwd)
  const merged = { ...saved }
  for (const [key, present] of Object.entries(detected)) {
    if (present) merged[key] = true
  }
  // simpleEnglish replaced caveman; honour the old key one last time.
  if (saved.caveman) merged.simpleEnglish = true
  return merged
}
