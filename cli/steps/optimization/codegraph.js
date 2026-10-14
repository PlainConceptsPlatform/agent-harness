import { execa } from 'execa'
import fse from 'fs-extra'
import path from 'node:path'
import os from 'node:os'
import { applyEdits, modify, parse as parseJsonc } from 'jsonc-parser'
import { header, success, warn, error, loading } from '../../utils/exec.js'

/**
 * Normalizes CodeGraph's MCP command in the selected OpenCode config.
 * Returns true if the config was successfully normalized (or no config exists).
 */
export async function fixCodegraphConfig(location = 'local') {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME?.trim()
  const configDir = location === 'global'
    ? path.join(xdgConfigHome || path.join(os.homedir(), '.config'), 'opencode')
    : process.cwd()
  const jsoncFile = path.join(configDir, 'opencode.jsonc')
  const jsonFile = path.join(configDir, 'opencode.json')
  const configFile = await fse.pathExists(jsoncFile)
    ? jsoncFile
    : await fse.pathExists(jsonFile)
      ? jsonFile
      : jsoncFile

  if (!await fse.pathExists(configFile)) return true

  let configText
  let config
  try {
    configText = await fse.readFile(configFile, 'utf-8')
    const errors = []
    config = parseJsonc(configText, errors)
    if (errors.length > 0) throw new Error(`parse errors: ${errors.length}`)
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error('unexpected structure')
    }
  } catch {
    warn('Could not parse opencode.jsonc, leaving it untouched')
    return false
  }

  const entry = config.mcp?.servers?.codegraph
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return true

  const normalizedEntry = { ...entry }
  let changed = false

  if (normalizedEntry.type == null) {
    normalizedEntry.type = 'local'
    changed = true
  }
  if (Array.isArray(normalizedEntry.command) && normalizedEntry.command[0] === 'codegraph') {
    normalizedEntry.command = ['npx', '--yes', '@colbymchenry/codegraph', ...normalizedEntry.command.slice(1)]
    changed = true
  }
  if (normalizedEntry.timeout == null) {
    normalizedEntry.timeout = {
      catalog: 120000,
      execution: 120000,
    }
    changed = true
  } else if (typeof normalizedEntry.timeout !== 'object' || Array.isArray(normalizedEntry.timeout)) {
    const timeout = Number.isFinite(normalizedEntry.timeout) && normalizedEntry.timeout > 0
      ? normalizedEntry.timeout
      : 120000
    normalizedEntry.timeout = { catalog: timeout, execution: timeout }
    changed = true
  }
  if (normalizedEntry.codemode !== false) {
    normalizedEntry.codemode = false
    changed = true
  }

  if (changed) {
    configText = applyEdits(configText, modify(configText, ['mcp', 'servers', 'codegraph'], normalizedEntry, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    }))
    await fse.writeFile(configFile, configText, 'utf-8')
    warn('Normalized codegraph MCP config in opencode.jsonc')
  }

  return true
}

export async function installCodegraph(options = {}) {
  if (!options.skipHeader) header('Installing codegraph')

  const location = options.installScope === 'global' ? 'global' : 'local'

  loading(`configuring codegraph for opencode (${location})...`)

  try {
    const installResult = await execa(
      'npx',
      ['--yes', '@colbymchenry/codegraph', 'install', '--target=opencode', `--location=${location}`, '--yes'],
      {
        cwd: process.cwd(),
        reject: false,
        stdio: 'pipe',
      }
    )

    if (installResult.exitCode !== 0) {
      warn('codegraph install exited with non-zero code')
      return { optedIn: true, installed: false }
    }

    const configFixed = await fixCodegraphConfig(location)

    if (!configFixed) {
      warn('codegraph config could not be merged: skipping init')
      return { optedIn: true, installed: false }
    }

    success(`codegraph configured for opencode (${location})`)
  } catch (err) {
    error(`Failed to install codegraph: ${err.message}`)
    return { optedIn: true, installed: false }
  }

  loading('initializing codegraph project index...')

  try {
    const initResult = await execa('npx', ['@colbymchenry/codegraph', 'init', '-i'], {
      cwd: process.cwd(),
      reject: false,
      stdio: 'pipe',
    })

    if (initResult.exitCode !== 0) {
      warn('codegraph init exited with non-zero code')
      return { optedIn: true, installed: false }
    }
    success('codegraph project index initialized')
  } catch (err) {
    error(`Failed to initialize codegraph: ${err.message}`)
    return { optedIn: true, installed: false }
  }

  return { optedIn: true, installed: true }
}
