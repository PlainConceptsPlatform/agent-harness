import { execa } from 'execa'
import fse from 'fs-extra'
import path from 'node:path'
import { applyEdits, modify, parse as parseJsonc } from 'jsonc-parser'
import { header, success, warn, error, loading } from '../../utils/exec.js'

/**
 * Normalizes codegraph's MCP entry in the project-level OpenCode config.
 * Older codegraph versions write `mcpServers`; OpenCode expects `mcp`.
 * Returns true if the config was successfully normalized (or no config exists).
 */
export async function fixCodegraphConfig() {
  const cwd = process.cwd()
  const configFile = path.join(cwd, 'opencode.jsonc')

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

  const legacyMcp = config.mcpServers
  const mcp = config.mcp || {}
  const entries = { ...legacyMcp, ...mcp }
  let changed = false

  if (Object.keys(entries).length > 0) {
    for (const entry of Object.values(entries)) {
      if (Array.isArray(entry.command) && entry.command[0] === 'codegraph') {
        entry.command = ['npx', '@colbymchenry/codegraph', ...entry.command.slice(1)]
        // codegraph defaults to a 30s MCP timeout, which fails under parallel
        // subagent load. Raise it unless the user has set one explicitly.
        if (entry.timeout == null) entry.timeout = 120000
      }
    }
    for (const [name, entry] of Object.entries(entries)) {
      const edits = modify(configText, ['mcp', name], entry, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      })
      configText = applyEdits(configText, edits)
      changed = true
    }
  }

  if (legacyMcp) {
    configText = applyEdits(configText, modify(configText, ['mcpServers'], undefined, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    }))
    changed = true
  }

  if (changed) {
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

    const configFixed = await fixCodegraphConfig()

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
