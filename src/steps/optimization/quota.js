import { confirm } from '@inquirer/prompts'
import fse from 'fs-extra'
import path from 'node:path'
import { fileURLToPath } from 'url'
import { applyEdits, modify, parse as parseJsonc } from 'jsonc-parser'
import { error, header, info, loading, success, warn } from '../../utils/exec.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const QUOTA_PRESET_PATH = path.resolve(__dirname, '../../presets/quota.json')
const quotaPreset = await fse.readJson(QUOTA_PRESET_PATH)
const PLUGIN = quotaPreset.plugin

export function splitPackageSpec(spec) {
  const separator = spec.startsWith('@') ? spec.indexOf('@', 1) : spec.lastIndexOf('@')
  if (separator === -1) return { name: spec, version: 'latest' }
  return { name: spec.slice(0, separator), version: spec.slice(separator + 1) }
}

function ensurePlugin(config) {
  if (!Array.isArray(config.plugin)) config.plugin = []
  if (!config.plugin.includes(PLUGIN)) config.plugin.push(PLUGIN)
}

export async function installQuota(options = {}) {
  if (!options.skipHeader) header('Installing opencode-quota')

  let shouldInstall = true
  if (!options.skipPrompt && process.stdin.isTTY) {
    // Same abort-on-timeout pattern as tokenOptimizationStep: never race a
    // live inquirer prompt, it leaks raw-mode stdin and unhandled rejections.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), quotaPreset.prompt.timeoutMs)
    try {
      shouldInstall = await confirm(
        {
          message: quotaPreset.prompt.message,
          default: quotaPreset.prompt.default,
        },
        { signal: controller.signal },
      )
    } catch (err) {
      if (err.name !== 'AbortPromptError') throw err
      shouldInstall = true
    } finally {
      clearTimeout(timer)
    }
  }

  if (!shouldInstall) {
    warn('Skipped opencode-quota installation')
    return { optedIn: false, installed: false }
  }

  loading('configuring opencode-quota...')

  try {
    const opencodeDir = path.join(process.cwd(), '.opencode')
    const opencodePath = path.join(process.cwd(), 'opencode.jsonc')
    const pkgPath = path.join(opencodeDir, 'package.json')
    const tuiPath = path.join(opencodeDir, 'tui.json')
    const quotaDir = path.join(opencodeDir, 'opencode-quota')
    const quotaPath = path.join(quotaDir, 'quota-toast.json')

    let opencodeText = JSON.stringify({ $schema: 'https://opencode.ai/config.json' }, null, 2)
    let opencode
    if (await fse.pathExists(opencodePath)) {
      const errors = []
      opencodeText = await fse.readFile(opencodePath, 'utf-8')
      opencode = parseJsonc(opencodeText, errors)
      if (errors.length > 0 || !opencode || typeof opencode !== 'object' || Array.isArray(opencode)) {
        throw new Error('opencode.jsonc could not be parsed')
      }
    } else {
      opencode = { $schema: 'https://opencode.ai/config.json' }
    }

    const pkg = await fse.pathExists(pkgPath)
      ? await fse.readJson(pkgPath)
      : {}

    const tui = await fse.pathExists(tuiPath)
      ? await fse.readJson(tuiPath)
      : { $schema: 'https://opencode.ai/tui.json' }

    const plugins = Array.isArray(opencode.plugin) ? opencode.plugin : []
    if (!plugins.includes(PLUGIN)) {
      plugins.push(PLUGIN)
      opencodeText = applyEdits(opencodeText, modify(opencodeText, ['plugin'], plugins, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      }))
    }
    ensurePlugin(tui)

    if (!pkg.dependencies) pkg.dependencies = {}
    const { name: pkgName, version: pkgVersion } = splitPackageSpec(PLUGIN)
    if (pkg.dependencies[pkgName] !== pkgVersion) pkg.dependencies[pkgName] = pkgVersion

    await fse.ensureDir(opencodeDir)
    await fse.writeFile(opencodePath, opencodeText, 'utf-8')
    await fse.writeJson(pkgPath, pkg, { spaces: 2 })
    await fse.writeJson(tuiPath, tui, { spaces: 2 })

    const quotaConfig = await fse.pathExists(quotaPath)
      ? await fse.readJson(quotaPath)
      : {}

    Object.assign(quotaConfig, quotaPreset.defaults)

    await fse.ensureDir(quotaDir)
    await fse.writeJson(quotaPath, quotaConfig, { spaces: 2 })

    success('opencode-quota configured (manual setup)')
    info('Restart OpenCode and run /quota to verify')
    return { optedIn: true, installed: true }
  } catch (err) {
    error(`Failed to configure opencode-quota: ${err.message}`)
    return { optedIn: true, installed: false }
  }
}
