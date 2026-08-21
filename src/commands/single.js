import fse from 'fs-extra'
import path from 'node:path'
import { fileURLToPath } from 'url'
import { cleanAiFiles } from '../steps/clean/index.js'
import { copyContentStep } from '../steps/copy/index.js'
import { chooseModels } from '../steps/models/index.js'
import { initOpenspec } from '../steps/openspec/index.js'
import { tokenOptimizationStep } from '../steps/optimization/index.js'
import { choosePlatform } from '../steps/platform/index.js'
import { installBrowser } from '../steps/browser/index.js'
import { writeHarnessConfig } from '../steps/metadata/index.js'
import { readHarnessConfig } from './shared.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const platformsPreset = await fse.readJson(path.resolve(__dirname, '../presets/platforms.json'))
// platforms.json is the single source of truth for valid platform values.
// Hardcoding a subset here silently rewrote jira/gitlab/browser projects to github.
const VALID_PLATFORMS = new Set(platformsPreset.map(p => p.value))

export function resolvePlatform(value, fallback = 'github') {
  return VALID_PLATFORMS.has(value) ? value : fallback
}

export async function runSingleCommand(command) {
  const saved = await readHarnessConfig()
  const ctx = {
    hasDesign: !!saved?.preexisting?.design,
    hasArchitecture: !!saved?.preexisting?.architecture,
    hasOpenspec: !!saved?.preexisting?.openspec,
    sourceMode: saved?.source?.mode ?? 'current',
    sourceRoots: Array.isArray(saved?.source?.roots) ? saved.source.roots : [],
    maxConcurrentAgents: saved?.agents?.maxConcurrent ?? 3,
  }
  const backlogPlatform = saved?.platform?.backlog
  const repoPlatform = saved?.platform?.repo
  const resolvedBacklog = resolvePlatform(backlogPlatform)
  const resolvedRepo = resolvePlatform(repoPlatform)

  const handlers = {
    clean: async () => {
      await cleanAiFiles()
    },
    platform: async () => {
      await choosePlatform()
    },
    copy: async () => {
      await copyContentStep({ backlogPlatform: resolvedBacklog, repoPlatform: resolvedRepo }, ctx)
    },
    openspec: async () => {
      await initOpenspec()
    },
    models: async () => {
      await chooseModels()
    },
    optimization: async () => {
      await tokenOptimizationStep({ ctx })
    },
    browser: async () => {
      await installBrowser()
    },
    metadata: async () => {
      await writeHarnessConfig({
        ...ctx,
        backlogPlatform: resolvedBacklog,
        repoPlatform: resolvedRepo,
        maxConcurrentAgents: saved?.agents?.maxConcurrent ?? 3,
        planModel: saved?.models?.plan ?? null,
        buildModel: saved?.models?.build ?? null,
        fastModel: saved?.models?.fast ?? null,
        optionalTools: saved?.tools ?? null,
      })
    },
  }

  const handler = handlers[command]
  if (!handler) return false
  await handler()
  return true
}
