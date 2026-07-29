import { select as wizardSelect } from '@inquirer/prompts'
import chalk from 'chalk'
import { ensureGitLongpaths } from './shared.js'
import { chooseSourceScope } from '../steps/source/index.js'
import { cleanAiFiles } from '../steps/clean/index.js'
import { choosePlatform } from '../steps/platform/index.js'
import { copyContentStep } from '../steps/copy/index.js'
import { initOpenspec } from '../steps/openspec/index.js'
import { chooseModels } from '../steps/models/index.js'
import { tokenOptimizationStep } from '../steps/optimization/index.js'
import { installBrowser } from '../steps/browser/index.js'
import { writeOnboardConfig } from '../steps/metadata/index.js'

export async function runWizard(version) {
  const logo = chalk.hex('#fe3d57')
  const bannerLines = [
    logo('                             '),
    logo('        ▒▒▒▒▒▒▒▒▒▒▒▒▒        '),
    logo('        ▒▒▓       ▓▒▓        '),
    logo('   ▒▒▒▒▒▒▓▒▒▒▒▒▒▒▒▒▓▓▒▒▒▒▒   '),
    logo('  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓  '),
    logo(' ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓ '),
    logo(' ▓▒▒▒▒░░░▒▒▒▒▒▒▒▒▒▒▒░░░▒▒▒▓▓ '),
    logo('  ▓▓▓▓▒▒▒▓▓▓▓▓▓▓▓▓▓▓▒▒▒▓▓▓▓  '),
    logo('  ▓▓▒▒▒▒▒▒░▒▒▒▒▒▒▒░▒▒▒▒▒▒▓▓  '),
    logo('  ▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓   '),
    logo('  ▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓   '),
    logo('   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓    '),
    '',
    chalk.bold('        🧰 opencode-onboard') + chalk.dim(` v${version}`),
    chalk.dim('        Prepare your codebase for AI agents'),
  ]

  for (const line of bannerLines) console.log(line)
  console.log()
  console.log('  This tool will set up your project with a team of AI agents,')
  console.log('  install skills, select models, and configure OpenCode.')
  console.log()

  // Only wait for Enter in a real interactive TTY
  if (process.stdin.isTTY) {
    console.log(chalk.bold('  Press Enter to begin...'))
    console.log()
    await new Promise(resolve => {
      process.stdin.resume()
      process.stdin.once('data', () => {
        process.stdin.pause()
        resolve()
      })
    })
  }

  const longpathsConfigured = await ensureGitLongpaths()
  if (longpathsConfigured) console.log(chalk.dim('  Git long paths enabled for this repository.'))

  const scope = await chooseSourceScope()

  const maxConcurrentAgents = await wizardSelect({
    message: 'Max concurrent agents:',
    default: 3,
    choices: [
      { name: '1', value: 1, description: 'Serial: one agent at a time' },
      { name: '2', value: 2, description: 'Conservative: lower resource usage' },
      { name: '3 (default)', value: 3, description: 'Recommended: balances speed vs MCP load' },
      { name: '4', value: 4, description: 'Higher parallelism' },
      { name: '5', value: 5, description: 'Maximum: needs more resources' },
    ],
  })

  const installScope = await wizardSelect({
    message: 'Install dependencies:',
    default: 'local',
    choices: [
      { name: 'Locally (default)', value: 'local', description: 'Install tools project-locally where possible' },
      { name: 'Globally', value: 'global', description: 'Install tools globally (affects all projects on this machine)' },
    ],
  })

  const preserve = await cleanAiFiles({ removeLegacyConfig: true })
  const ctx = { ...preserve, ...scope, maxConcurrentAgents, installScope }

  const { backlogPlatform, repoPlatform } = await choosePlatform()

  await copyContentStep({ backlogPlatform, repoPlatform }, ctx)

  const openspec = await initOpenspec()

  const selectedModels = await chooseModels()

  const tokenOpt = await tokenOptimizationStep({ ctx })
  const { rtk, quota, caveman, cavemanGuidance } = tokenOpt

  await installBrowser(ctx)

  await writeOnboardConfig({
    ...ctx,
    backlogPlatform,
    repoPlatform,
    openspec,
    maxConcurrentAgents,
    installScope,
    additionalSkillsProvider: 'npx-skills',
    ...selectedModels,
    optionalTools: { rtk, quota, caveman },
    cavemanGuidance,
  })

  const toGenerate = [
    !ctx.hasDesign && 'DESIGN.md',
    !ctx.hasArchitecture && 'ARCHITECTURE.md',
  ].filter(Boolean)

  console.log()
  console.log(chalk.bold.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log(chalk.bold.green('  Onboarding complete!'))
  console.log(chalk.bold.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log()
  console.log('  Open this project in OpenCode and type:')
  console.log(chalk.bold('  "/init"'))
  console.log('  Or run the following command in your terminal:')
  console.log(chalk.bold('  opencode --prompt "/init" --model "opencode/big-pickle"  '))
  console.log()
  console.log(chalk.dim('  Note: the first time you open OpenCode in this project,'))
  console.log(chalk.dim('  it will install plugin dependencies. You may see a black'))
  console.log(chalk.dim('  screen for a moment: this is normal. Wait for it to load.'))
  console.log()
  if (toGenerate.length > 0) {
    console.log(`  OpenCode will generate ${toGenerate.join(' and ')}`)
    console.log('  from your actual codebase, then activate the agent team.')
  } else {
    console.log('  OpenCode will activate the agent team.')
  }
  console.log(`  Source scope: ${ctx.sourceMode === 'parent-selected' ? ctx.sourceRoots.map(p => `../${p.split(/[/\\]/).pop()}`).join(', ') : 'current folder'}`)
  console.log()
}
