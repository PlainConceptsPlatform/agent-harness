import chalk from 'chalk'
import { execa } from 'execa'
import fse from 'fs-extra'
import path from 'node:path'
import { fileURLToPath } from 'url'
import { readHarnessConfig } from './shared.js'
import { copyContentStep } from '../steps/copy/index.js'
import { writeModelsToConfigs } from '../steps/models/write.js'
import { patchGuardrails } from '../steps/optimization/patch-guardrails.js'
import { writeHarnessConfig } from '../steps/metadata/index.js'
import { exit } from '../utils/process.js'

const SIMPLE_ENGLISH_ENTRY = {
  source: 'AminBlg/SimpleEnglish',
  sourceType: 'github',
  skillPath: 'skills/simple-english/SKILL.md',
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const platformsPreset = await fse.readJson(path.resolve(__dirname, '../presets/platforms.json'))
const VALID_PLATFORMS = new Set(platformsPreset.map(p => p.value))

function resolvePlatform(value, fallback = 'github') {
  return VALID_PLATFORMS.has(value) ? value : fallback
}

export async function runUpdate() {
  const saved = await readHarnessConfig()
  if (!saved?.platform) {
    console.log(chalk.red('No agent-harness config found. Run the wizard first.'))
    exit(1)
    return
  }

  const backlogPlatform = resolvePlatform(saved.platform.backlog)
  const repoPlatform = resolvePlatform(saved.platform.repo)

  const ctx = {
    hasDesign: !!saved.preexisting?.design,
    hasArchitecture: !!saved.preexisting?.architecture,
    hasOpenspec: !!saved.preexisting?.openspec,
    sourceMode: saved.source?.mode ?? 'current',
    sourceRoots: Array.isArray(saved.source?.roots) ? saved.source.roots : [],
    maxConcurrentAgents: saved.agents?.maxConcurrent ?? 3,
    installScope: 'local',
    skipSkills: false,
    updateMode: true,
  }

  console.log()
  console.log(chalk.bold('Updating project from saved config'))
  console.log(chalk.dim(`  backlog: ${backlogPlatform}  repo: ${repoPlatform}  agents: ${ctx.maxConcurrentAgents}`))
  console.log()

  await copyContentStep({ backlogPlatform, repoPlatform }, ctx)

  if (saved.models) {
    await writeModelsToConfigs({ buildModel: saved.models.build })
  }

  const tools = saved.tools ?? {}
  await migrateCavemanSkill(tools)
  await patchGuardrails({
    rtk: !!tools.rtk,
    simpleEnglish: !!(tools.simpleEnglish || tools.caveman),
    codegraph: !!tools.codegraph,
    memory: !!tools.memory,
    humanizer: !!tools.humanizer,
  })

  await writeHarnessConfig({
    ...ctx,
    backlogPlatform,
    repoPlatform,
    maxConcurrentAgents: ctx.maxConcurrentAgents,
    planModel: saved.models?.plan ?? null,
    buildModel: saved.models?.build ?? null,
    fastModel: saved.models?.fast ?? null,
    optionalTools: tools,
  })

  console.log()
  console.log(chalk.bold.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log(chalk.bold.green('  Update complete!'))
  console.log(chalk.bold.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log()
}

async function migrateCavemanSkill(tools) {
  if (!tools.caveman || tools.simpleEnglish) return

  const lockPath = path.join(process.cwd(), 'skills-lock.json')
  const lock = await fse.readJson(lockPath).catch(() => ({ version: 1, skills: {} }))
  lock.skills ??= {}
  delete lock.skills.caveman
  lock.skills['simple-english'] = SIMPLE_ENGLISH_ENTRY
  await fse.writeJson(lockPath, lock, { spaces: 2 })
  await fse.remove(path.join(process.cwd(), '.agents', 'skills', 'caveman'))

  const result = await execa('npx', ['skills', 'experimental_install', '--yes'], {
    cwd: process.cwd(),
    reject: false,
    stdio: 'pipe',
    timeout: 600000,
  })
  if (result.exitCode !== 0) {
    console.log(chalk.yellow('Simple English was added to skills-lock.json but could not be installed. Run npx skills experimental_install --yes.'))
  }
}
