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

async function shouldInstallQuota(options) {
  if (options.skipPrompt || !process.stdin.isTTY) return true

  // Same abort-on-timeout pattern as tokenOptimizationStep: never race a
  // live inquirer prompt, it leaks raw-mode stdin and unhandled rejections.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), quotaPreset.prompt.timeoutMs)
  try {
    return await confirm(
      {
        message: quotaPreset.prompt.message,
        default: quotaPreset.prompt.default,
      },
      { signal: controller.signal },
    )
  } catch (err) {
    if (err.name !== 'AbortPromptError') throw err
    return true
  } finally {
    clearTimeout(timer)
  }
}

async function readOpencode(opencodePath) {
  if (!(await fse.pathExists(opencodePath))) {
    const config = { $schema: 'https://opencode.ai/config.json' }
    return { text: JSON.stringify(config, null, 2), config }
  }

  const text = await fse.readFile(opencodePath, 'utf-8')
  const errors = []
  const config = parseJsonc(text, errors)
  if (errors.length > 0 || !config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('opencode.jsonc could not be parsed')
  }
  return { text, config }
}

function pluginsWithQuota(config, pkgName) {
  // V2 configures server plugins under `plugins`. A V1 `plugin` array found
  // here is carried over so the quota entry is not lost when the config
  // patcher has not run first. An older pin is upgraded in place instead of
  // appending a second entry for the same package.
  const plugins = Array.isArray(config.plugins)
    ? [...config.plugins]
    : Array.isArray(config.plugin)
      ? [...config.plugin]
      : []
  const quotaIndex = plugins.findIndex(entry =>
    typeof entry === 'string' && (entry === pkgName || entry.startsWith(`${pkgName}@`)))
  if (quotaIndex === -1) {
    plugins.push(PLUGIN)
    return { plugins, changed: true }
  }
  if (plugins[quotaIndex] === PLUGIN) return { plugins, changed: false }
  plugins[quotaIndex] = PLUGIN
  return { plugins, changed: true }
}

async function readPackage(pkgPath) {
  return (await fse.pathExists(pkgPath)) ? fse.readJson(pkgPath) : {}
}

async function readQuotaSettings(quotaPath, legacyQuotaPath) {
  if (await fse.pathExists(quotaPath)) return fse.readJson(quotaPath)
  if (await fse.pathExists(legacyQuotaPath)) return fse.readJson(legacyQuotaPath)
  return {}
}

async function removeLegacyQuota(legacyQuotaPath) {
  if (!(await fse.pathExists(legacyQuotaPath))) return
  await fse.remove(legacyQuotaPath)
  const legacyDir = path.dirname(legacyQuotaPath)
  if ((await fse.readdir(legacyDir)).length === 0) {
    await fse.remove(legacyDir)
  }
  info('Moved opencode-quota settings to opencode-quota/quota-toast.jsonc')
}

export async function installQuota(options = {}) {
  if (!options.skipHeader) header('Installing opencode-quota')

  const shouldInstall = await shouldInstallQuota(options)
  if (!shouldInstall) {
    warn('Skipped opencode-quota installation')
    return { optedIn: false, installed: false }
  }

  loading('configuring opencode-quota...')

  try {
    const opencodeDir = path.join(process.cwd(), '.opencode')
    const opencodePath = path.join(process.cwd(), 'opencode.jsonc')
    const pkgPath = path.join(opencodeDir, 'package.json')

    // opencode-quota 5.x reads its settings from `opencode-quota/quota-toast.jsonc`
    // next to the OpenCode config (project root), not from `.opencode/`. The old
    // `.opencode/opencode-quota/quota-toast.json` is the v4 location and is migrated
    // below so the settings actually take effect.
    const quotaDir = path.join(process.cwd(), 'opencode-quota')
    const quotaPath = path.join(quotaDir, 'quota-toast.jsonc')
    const legacyQuotaPath = path.join(opencodeDir, 'opencode-quota', 'quota-toast.json')

    const { name: pkgName, version: pkgVersion } = splitPackageSpec(PLUGIN)

    const { text: opencodeText, config: opencode } = await readOpencode(opencodePath)
    const { plugins, changed } = pluginsWithQuota(opencode, pkgName)
    const nextText = changed
      ? applyEdits(opencodeText, modify(opencodeText, ['plugins'], plugins, {
          formattingOptions: { insertSpaces: true, tabSize: 2 },
        }))
      : opencodeText

    const pkg = await readPackage(pkgPath)
    if (!pkg.dependencies) pkg.dependencies = {}
    if (pkg.dependencies[pkgName] !== pkgVersion) pkg.dependencies[pkgName] = pkgVersion

    await fse.ensureDir(opencodeDir)
    await fse.writeFile(opencodePath, nextText, 'utf-8')
    await fse.writeJson(pkgPath, pkg, { spaces: 2 })

    const quotaConfig = await readQuotaSettings(quotaPath, legacyQuotaPath)
    Object.assign(quotaConfig, quotaPreset.defaults)

    await fse.ensureDir(quotaDir)
    await fse.writeJson(quotaPath, quotaConfig, { spaces: 2 })
    await removeLegacyQuota(legacyQuotaPath)

    success('opencode-quota configured (popups and notifications disabled)')
    info('Restart OpenCode and run /quota to verify')
    return { optedIn: true, installed: true }
  } catch (err) {
    error(`Failed to configure opencode-quota: ${err.message}`)
    return { optedIn: true, installed: false }
  }
}
