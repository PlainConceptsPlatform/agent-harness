import { select } from '@inquirer/prompts'
import { execa } from 'execa'
import fse from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { code, commandExists, header, info, success, warn } from '../../utils/exec.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLATFORMS_PRESET_PATH = path.resolve(__dirname, '../../presets/platforms.json')
const platformsPreset = await fse.readJson(PLATFORMS_PRESET_PATH)


export async function checkPlatform(platform) {
  const preset = platformsPreset.find(p => p.value === platform) || platformsPreset[0]
  if (!preset.cli) {
    header(`Step 4, Checking ${preset.name} CLI`)
    info('No platform integration selected, skipping CLI checks.')
    success(`Platform: ${preset.name}`)
    return
  }
  await checkPlatformCli(preset)
}

export async function choosePlatform() {
  header('Step 3, Version control platform')

  const backlogChoices = platformsPreset.filter(p => !p.repoOnly)
  const backlogPlatform = await select({
    message: 'Where is your backlog (work items / issues)?',
    choices: backlogChoices.map(p => ({ name: p.name, value: p.value })),
  })

  const backlogPreset = platformsPreset.find(p => p.value === backlogPlatform)
  success(`Backlog platform: ${backlogPreset?.name || backlogPlatform}`)

  let repoPlatform = backlogPlatform
  if (backlogPlatform !== 'none') {
    // Exclude backlog-only platforms (e.g. Jira) from repo choices
    const repoChoices = platformsPreset.filter(p => !p.backlogOnly)
    repoPlatform = await select({
      message: 'Where is your code repository (PRs / code reviews)?',
      choices: repoChoices.map(p => ({ name: p.name, value: p.value })),
      default: backlogPreset.backlogOnly ? 'github' : backlogPlatform,
    })
    const repoPreset = platformsPreset.find(p => p.value === repoPlatform)
    success(`Repo platform: ${repoPreset?.name || repoPlatform}`)
  }

  // Check CLIs for both platforms (deduped)
  const platformsToCheck = [...new Set([backlogPlatform, repoPlatform])].filter(p => p !== 'none')
  for (const p of platformsToCheck) {
    const preset = platformsPreset.find(x => x.value === p)
    if (preset?.cli) await checkPlatformCli(preset)
  }

  return { backlogPlatform, repoPlatform }
}

async function checkPlatformCli(platformPreset) {
  const { cli } = platformPreset
  header(`Step 4, Checking ${platformPreset.name} CLI`)

  const hasCli = await commandExists(cli.command)
  if (!hasCli) {
    warn(`${cli.displayName} not found.`)
    info(`Install from: ${cli.installUrl}`)
    if (cli.authCheck?.commands?.length) {
      console.log()
      info('After installing, authenticate with:')
      code(cli.authCheck.commands)
    }
    return
  }
  success(`${cli.displayName} available`)

  if (cli.authCheck) await runAuthCheck(cli)
  if (cli.extensionCheck) await runExtensionCheck(cli)
}

async function runAuthCheck(cli) {
  try {
    const result = await execa(cli.command, cli.authCheck.args, { reject: false })
    if (result.exitCode === 0) {
      success(`${cli.displayName} authenticated`)
    } else {
      warn(cli.authCheck.notAuthenticatedMessage)
      code(cli.authCheck.commands)
    }
  } catch {
    warn(`Could not check ${cli.command} auth status.`)
  }
}

async function runExtensionCheck(cli) {
  try {
    const result = await execa(cli.command, cli.extensionCheck.args, { reject: false })
    const hasExtension = result.stdout && result.stdout.includes(cli.extensionCheck.expectedOutput)

    if (hasExtension) {
      success(`${cli.extensionCheck.expectedOutput} extension installed`)
    } else {
      warn(cli.extensionCheck.missingMessage)
      code(cli.extensionCheck.commands)
    }
  } catch {
    warn(cli.extensionCheck.errorMessage)
    code(cli.extensionCheck.commands)
  }
}
