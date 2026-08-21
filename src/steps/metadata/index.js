import { execa } from 'execa'
import fse from 'fs-extra'
import path from 'path'
import { createRequire } from 'node:module'
import { header, success, warn } from '../../utils/exec.js'
import { configPath } from '../../utils/paths.js'

const require = createRequire(import.meta.url)
const { version: harnessVersion } = require('../../../package.json')

function clampConcurrency(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 3
  return Math.min(5, Math.max(1, Math.round(v)))
}

async function detectOpencodeVersion() {
  try {
    const result = await execa('opencode', ['--version'], { reject: false })
    if (result.exitCode !== 0) return null
    const output = (result.stdout || result.stderr || '').trim()
    return output || null
  } catch {
    return null
  }
}

export async function writeHarnessConfig(data) {
  header('Step 10, Writing onboarding metadata')

  const opencodeVersion = await detectOpencodeVersion()
  const cwd = data.cwd ?? process.cwd()
  const target = configPath(cwd)

  // Read the existing file so load-bearing config (models, maxConcurrent)
  // is preserved across metadata refreshes when not explicitly provided.
  const existing = await fse.readJson(target).catch(() => null)

  const selectedModels = Object.fromEntries(
    Object.entries({
      plan: data.planModel,
      build: data.buildModel,
      fast: data.fastModel,
    }).filter(([, value]) => value)
  )
  const models = Object.keys(selectedModels).length > 0
    ? { ...existing?.models, ...selectedModels }
    : existing?.models ?? null
  const maxConcurrent = clampConcurrency(data.maxConcurrentAgents ?? existing?.agents?.maxConcurrent ?? 3)

  const optionalTools = data.optionalTools ?? existing?.tools ?? {}
  const { caveman: _caveman, ...existingTools } = existing?.tools ?? {}
  const tools = {
    rtk: !!(optionalTools.rtk?.optedIn ?? optionalTools.rtk),
    quota: !!(optionalTools.quota?.optedIn ?? optionalTools.quota),
    simpleEnglish: !!(
      optionalTools.simpleEnglish?.optedIn ?? optionalTools.simpleEnglish ??
      optionalTools.caveman?.optedIn ?? optionalTools.caveman
    ),
    codegraph: !!(optionalTools.codegraph?.optedIn ?? optionalTools.codegraph),
    memory: !!(optionalTools.memory?.optedIn ?? optionalTools.memory),
  }

  const payload = {
    ...existing,
    version: 2,
    generatedAt: new Date().toISOString(),
    harnessVersion,
    opencodeVersion,

    platform: {
      ...existing?.platform,
      backlog: data.backlogPlatform ?? 'none',
      repo: data.repoPlatform ?? 'none',
    },

    ...(models ? { models } : {}),

    agents: {
      ...existing?.agents,
      maxConcurrent,
    },

    source: {
      ...existing?.source,
      mode: data.sourceMode ?? 'current',
      roots: data.sourceRoots ?? [],
    },

    tools: { ...existingTools, ...tools },

    preexisting: {
      ...existing?.preexisting,
      design: !!data.hasDesign,
      architecture: !!data.hasArchitecture,
      openspec: !!data.hasOpenspec,
    },
  }

  try {
    await fse.ensureDir(path.dirname(target))
    await fse.writeJson(target, payload, { spaces: 2 })
    success('Wrote .opencode/harness.json')
    if (!opencodeVersion) warn('Could not detect opencode version, saved as null')
  } catch (err) {
    warn(`Could not write onboarding metadata: ${err.message}`)
  }
}
