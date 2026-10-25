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

    // opencode-quota 5.x reads its settings from `opencode-quota/quota-toast.jsonc`
    // next to the OpenCode config (project root), not from `.opencode/`. The old
    // `.opencode/opencode-quota/quota-toast.json` is the v4 location and is migrated
    // below so the settings actually take effect.
    const quotaDir = path.join(process.cwd(), 'opencode-quota')
    const quotaPath = path.join(quotaDir, 'quota-toast.jsonc')
    const legacyQuotaPath = path.join(opencodeDir, 'opencode-quota', 'quota-toast.json')

    const { name: pkgName, version: pkgVersion } = splitPackageSpec(PLUGIN)

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

    // V2 configures server plugins under `plugins`. A V1 `plugin` array found
    // here is carried over so the quota entry is not lost when the config
    // patcher has not run first. An older pin is upgraded in place instead of
    // appending a second entry for the same package.
    const plugins = Array.isArray(opencode.plugins)
      ? [...opencode.plugins]
      : Array.isArray(opencode.plugin)
        ? [...opencode.plugin]
        : []
    const quotaIndex = plugins.findIndex(entry =>
      typeof entry === 'string' && (entry === pkgName || entry.startsWith(`${pkgName}@`)))
    let pluginsChanged = false
    if (quotaIndex === -1) {
      plugins.push(PLUGIN)
      pluginsChanged = true
    } else if (plugins[quotaIndex] !== PLUGIN) {
      plugins[quotaIndex] = PLUGIN
      pluginsChanged = true
    }
    if (pluginsChanged) {
      opencodeText = applyEdits(opencodeText, modify(opencodeText, ['plugins'], plugins, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      }))
    }

    if (!pkg.dependencies) pkg.dependencies = {}
    if (pkg.dependencies[pkgName] !== pkgVersion) pkg.dependencies[pkgName] = pkgVersion

    await fse.ensureDir(opencodeDir)
    await fse.writeFile(opencodePath, opencodeText, 'utf-8')
    await fse.writeJson(pkgPath, pkg, { spaces: 2 })

    // Carry over any existing settings (new location first, then the legacy
    // v4 file) and layer the recommended defaults on top. The edge defaults
    // disable toasts and reset notifications and keep slash reports inline.
    let quotaConfig = {}
    if (await fse.pathExists(quotaPath)) {
      quotaConfig = await fse.readJson(quotaPath)
    } else if (await fse.pathExists(legacyQuotaPath)) {
      quotaConfig = await fse.readJson(legacyQuotaPath)
    }

    Object.assign(quotaConfig, quotaPreset.defaults)

    await fse.ensureDir(quotaDir)
    await fse.writeJson(quotaPath, quotaConfig, { spaces: 2 })

    if (await fse.pathExists(legacyQuotaPath)) {
      await fse.remove(legacyQuotaPath)
      const legacyDir = path.dirname(legacyQuotaPath)
      if ((await fse.readdir(legacyDir)).length === 0) {
        await fse.remove(legacyDir)
      }
      info('Moved opencode-quota settings to opencode-quota/quota-toast.jsonc')
    }

    success('opencode-quota configured (popups and notifications disabled)')
    info('Restart OpenCode and run /quota to verify')
    return { optedIn: true, installed: true }
  } catch (err) {
    error(`Failed to configure opencode-quota: ${err.message}`)
    return { optedIn: true, installed: false }
  }
}
