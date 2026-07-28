#!/usr/bin/env node
import chalk from 'chalk'
import { createRequire } from 'node:module'
import { runJoin } from './commands/join.js'
import { runUpdate } from './commands/update.js'
import { runSingleCommand } from './commands/single.js'
import { runWizard } from './commands/wizard.js'
import { exit } from './utils/process.js'

function printHelp(version) {
  console.log(`opencode-onboard v${version}`)
  console.log()
  console.log('Usage:')
  console.log('  npx @plainconceptsplatform/opencode-onboard             Run full onboarding wizard')
  console.log('  npx @plainconceptsplatform/opencode-onboard <command>   Run a single step command')
  console.log()
  console.log('Commands:')
  console.log('  join            New team member setup (checks & local installs only)')
  console.log('  update          Re-apply all file patches from saved config (no prompts)')
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

if (args.length > 0) {
  try {
    if (args[0] === 'join') {
      await runJoin()
    } else if (args[0] === 'update') {
      await runUpdate()
    } else {
      const ok = await runSingleCommand(args[0])
      if (!ok) {
        console.log(chalk.red(`Unknown command: ${args[0]}`))
        console.log()
        printHelp(version)
        exit(1)
      }
    }
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
}

try {
  await runWizard(version)
} catch (err) {
  if (err.name === 'ExitPromptError') {
    console.log()
    console.log(chalk.yellow('Cancelled.'))
  } else {
    console.error(chalk.red('\nUnexpected error:'), err.message)
    exit(1)
  }
}
