#!/usr/bin/env node
import chalk from 'chalk'
import { createRequire } from 'node:module'
import { runJoin } from './commands/join.js'
import { runUpdate } from './commands/update.js'
import { runSingleCommand } from './commands/single.js'
import { runWizard } from './commands/wizard.js'
import { exit } from './utils/process.js'
import { runMigrateCommand } from './commands/migrate.js'
import { findLegacyInstall } from './utils/legacy-check.js'

function printHelp(version) {
  console.log(`agent-harness v${version}`)
  console.log()
  console.log('Usage:')
  console.log('  npx @plainconceptsplatform/agent-harness             Install the harness (full wizard)')
  console.log('  npx @plainconceptsplatform/agent-harness <command>   Run a single step command')
  console.log()
  console.log('Commands:')
  console.log('  update          Bring the harness up to date from saved config (no prompts)')
  console.log('  migrate         Move a v1 (opencode-onboard) project to v2, keeping your content')
  console.log('  join            Set up a teammate\'s machine (checks & local installs only)')
  console.log('  clean           Run AI files cleanup step')
  console.log('  platform        Run platform selection step')
  console.log('  copy            Run content copy step')
  console.log('  openspec        Run OpenSpec initialization step')
  console.log('  models          Run models selection step')
  console.log('  optimization    Run token optimization tools step')
  console.log('  browser         Run opencode-browser installer step')
  console.log('  metadata        Write onboarding metadata step')
  console.log()
  console.log('Options:')
  console.log('  -h, --help      Show this help message')
}

if (process.stdout.isTTY) console.clear()
console.log()
const require = createRequire(import.meta.url)
const { version } = require('../package.json')
const args = process.argv.slice(2)

if (args.includes('-h') || args.includes('--help')) {
  printHelp(version)
  exit()
}

async function refuseLegacyInstall() {
  const legacy = await findLegacyInstall()
  if (!legacy) return false

  console.log(chalk.red('This project was set up by opencode-onboard v1.'))
  console.log()
  if (legacy.files.length > 0) console.log(chalk.dim(`  config:  ${legacy.files.join(', ')}`))
  if (legacy.skills.length > 0) {
    const shown = legacy.skills.slice(0, 3).join(', ')
    const rest = legacy.skills.length > 3 ? `, +${legacy.skills.length - 3} more` : ''
    console.log(chalk.dim(`  skills:  ${shown}${rest}`))
  }
  console.log()
  console.log('agent-harness v2 renamed both the config files and the skill prefix,')
  console.log('and it does not migrate v1 projects. Continuing would leave the harness')
  console.log('half-patched without reporting an error.')
  console.log()
  console.log('Migrate it, keeping your generated skills and custom engineers:')
  console.log(chalk.dim('  npx @plainconceptsplatform/agent-harness migrate'))
  console.log(chalk.dim('  npx @plainconceptsplatform/agent-harness update'))
  console.log()
  console.log(chalk.dim('Add --dry-run to see what migrate would change first.'))
  return true
}

// Ctrl-C out of an @inquirer prompt throws ExitPromptError; that is a normal
// cancellation, not a crash, so it must not exit non-zero.
async function main() {
  // migrate is the way out of a v1 project, so it must run before the guard
  // that refuses v1 projects.
  if (args[0] === 'migrate') {
    await runMigrateCommand(args.slice(1))
    return
  }
  if (await refuseLegacyInstall()) {
    exit(1)
    return
  }
  if (args.length === 0) {
    await runWizard(version)
    return
  }
  if (args[0] === 'join') {
    await runJoin()
    return
  }
  if (args[0] === 'update') {
    await runUpdate()
    return
  }
  if (!await runSingleCommand(args[0])) {
    console.log(chalk.red(`Unknown command: ${args[0]}`))
    console.log()
    printHelp(version)
    exit(1)
  }
}

try {
  await main()
} catch (err) {
  if (err.name === 'ExitPromptError') {
    console.log()
    console.log(chalk.yellow('Cancelled.'))
  } else {
    console.error(chalk.red('\nUnexpected error:'), err.message)
    exit(1)
  }
}
exit()
