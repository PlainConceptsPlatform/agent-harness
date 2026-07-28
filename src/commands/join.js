import chalk from 'chalk'
import { execa } from 'execa'
import fse from 'fs-extra'
import path from 'node:path'
import { installBrowser } from '../steps/browser/index.js'
import { checkRtk } from '../steps/optimization/index.js'
import { checkPlatform } from '../steps/platform/index.js'
import { commandExists, header, info, loading, success, warn } from '../utils/exec.js'
import { readOnboardConfig } from './shared.js'

export async function runJoin() {
  const logo = chalk.hex('#fe3d57')
  console.log()
  console.log(logo('  🤝 opencode-onboard join'))
  console.log(chalk.dim('  New team member setup: checks & local installs only.'))
  console.log(chalk.dim('  Does not modify committed project files.'))
  console.log()

  const saved = await readOnboardConfig()

  if (!saved) {
    warn('No .opencode/opencode-onboard.json found.')
    warn('This project may not have been onboarded yet. Run `npx @plainconceptsplatform/opencode-onboard` first.')
    return
  }

  const backlogPlatform = saved?.platform?.backlog
  const repoPlatform = saved?.platform?.repo
  const installScope = 'local'
  const teamModels = saved?.models ?? {}

  const opencodeDir = path.join(process.cwd(), '.opencode')
  const opencodeJsonPath = path.join(opencodeDir, 'opencode.json')

  // Step 1: Platform CLI check
  header('Step 1, Platform CLI check')
  const platformsToCheck = [...new Set([backlogPlatform, repoPlatform])].filter(p => p && p !== 'none')
  if (platformsToCheck.length === 0) {
    info('No platform integration selected, skipping CLI checks.')
  } else {
    for (const p of platformsToCheck) {
      const display = p === 'github' ? 'GitHub' : p === 'azure' ? 'Azure DevOps' : p
      info(`Checking platform: ${display}`)
      await checkPlatform(p)
    }
  }

  // Step 2: Install OpenCode plugins
  header('Step 2, Installing OpenCode plugins')
  const pkgPath = path.join(opencodeDir, 'package.json')
  if (await fse.pathExists(pkgPath)) {
    try {
      await execa('npm', ['install'], { cwd: opencodeDir, reject: false, stdio: 'pipe' })
      success('OpenCode plugins installed')
    } catch {
      warn('npm install failed in .opencode/: plugins may not load correctly')
    }
  } else {
    warn('No .opencode/package.json found: skipping plugin install')
  }

  // Step 3: Install/update skills
  header('Step 3, Installing skills')
  try {
    await execa('npx', ['skills'], { cwd: process.cwd(), reject: false, stdio: 'pipe' })
    success('Skills installed/updated')
  } catch {
    warn('npx skills failed: skills may be missing')
  }

  // Step 4: OpenSpec CLI check
  header('Step 4, Checking OpenSpec')
  const openspecAvailable = await commandExists('openspec')
  if (openspecAvailable) {
    success('OpenSpec CLI is available')
  } else {
    info('OpenSpec not found on PATH: installing...')
    try {
      const result = await execa('npm', ['install', '@fission-ai/openspec', '--global'], {
        cwd: process.cwd(),
        reject: false,
        stdio: 'pipe',
      })
      if (result.exitCode === 0) {
        success('OpenSpec installed')
      } else {
        warn('OpenSpec install failed: run `npm install -g @fission-ai/openspec` manually')
      }
    } catch {
      warn('OpenSpec install failed: run `npm install -g @fission-ai/openspec` manually')
    }
  }

  // Step 5: agentmemory (if project uses it)
  header('Step 5, Checking agentmemory')
  let cfg = {}
  if (await fse.pathExists(opencodeJsonPath)) {
    try {
      cfg = await fse.readJson(opencodeJsonPath)
    } catch {
      // ignore config read errors
    }
  }

  if (cfg?.mcp?.['agentmemory']) {
    info('Project uses agentmemory MCP')
    loading('checking agentmemory server...')

    // Check if agentmemory is installed
    const agentmemoryAvailable = await commandExists('agentmemory')
    if (agentmemoryAvailable) {
      success('agentmemory CLI is available')
    } else {
      info('agentmemory not found on PATH, installing...')
      try {
        const installResult = await execa('npm', ['install', '-g', '@agentmemory/agentmemory'], {
          reject: false,
          timeout: 300000,
          stdio: 'pipe',
        })
        if (installResult.exitCode === 0) {
          success('agentmemory installed')
        } else {
          warn('agentmemory install failed, run `npm install -g @agentmemory/agentmemory` manually')
        }
      } catch (err) {
        warn(`agentmemory install failed: ${err.message}`)
      }
    }

    // Health-check the server
    try {
      const healthResult = await execa('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://localhost:3111/agentmemory/health'], {
        reject: false,
        timeout: 5000,
      })
      if (healthResult.stdout.trim() === '200') {
        success('agentmemory server is running')
      } else {
        info('agentmemory server not running, start it with `agentmemory` in a separate terminal')
      }
    } catch {
      info('agentmemory server not running, start it with `agentmemory` in a separate terminal')
    }
  } else {
    info('agentmemory not configured for this project, skipping')
  }

  // Step 6: Codegraph (if project uses it)
  header('Step 6, Checking codegraph')
  if (cfg?.mcp?.['codegraph']) {
    info('Project uses codegraph MCP: building index...')
    try {
      const result = await execa('npx', ['--yes', '@colbymchenry/codegraph', 'init', '-i'], {
        cwd: process.cwd(),
        reject: false,
        stdio: 'pipe',
        timeout: 120000,
      })
      if (result.exitCode === 0) {
        success('codegraph index initialized')
      } else {
        warn('codegraph init failed: codegraph_search may be slow or unavailable')
      }
    } catch {
      warn('codegraph init failed: codegraph_search may be slow or unavailable')
    }
  } else {
    info('codegraph not configured for this project: skipping')
  }

  // Step 7: RTK check
  header('Step 7, Checking rtk')
  await checkRtk({ skipHeader: true, skipPrompt: true })

  // Step 8: Browser extension
  header('Step 8, Installing opencode-browser')
  await installBrowser({ installScope })

  // Step 9: Model tier guidance
  header('Step 9, Model tiers')
  const userConfigPath = path.join(opencodeDir, 'opencode-onboard.user.json')
  const hasUserOverride = await fse.pathExists(userConfigPath)

  if (teamModels && Object.keys(teamModels).length > 0) {
    info('Team model configuration:')
    for (const [tier, model] of Object.entries(teamModels)) {
      info(`  ${tier}: ${model}`)
    }
    console.log()

    if (hasUserOverride) {
      info('You have a local model override (opencode-onboard.user.json).')
      info('To change: /make-user-model user <tier> <model>')
    } else {
      info('No local override: using team defaults.')
      info('To override a tier for your machine: /make-user-model user <tier> <model>')
      info('  e.g. /make-user-model user build current')
    }
    console.log()
    info('The ob-subagent-tiers plugin will generate *-engineer.<tier>.md variants')
    info('on opencode startup from these model configs.')
  } else {
    warn('No model tiers configured in opencode-onboard.json.')
    warn('Run /make-user-model <tier> <model> for plan, build, and fast.')
  }

  // Step 10: Ensure .opencode/.gitignore exists
  header('Step 10, Checking .opencode/.gitignore')
  const gitignorePath = path.join(opencodeDir, '.gitignore')
  const requiredEntries = ['node_modules', '.ob-run.json', 'opencode-onboard.user.json', 'source-roots.json', '*-engineer.*.md']

  if (await fse.pathExists(gitignorePath)) {
    const content = await fse.readFile(gitignorePath, 'utf-8')
    const existing = content.split('\n').map(l => l.trim()).filter(Boolean)
    const missing = requiredEntries.filter(e => !existing.includes(e))
    if (missing.length > 0) {
      const merged = `${[...existing, ...missing].join('\n')}\n`
      await fse.writeFile(gitignorePath, merged, 'utf-8')
      success(`Merged ${missing.length} missing .gitignore entries`)
    } else {
      success('.gitignore is up to date')
    }
  } else {
    await fse.writeFile(gitignorePath, `${requiredEntries.join('\n')}\n`, 'utf-8')
    success('Created .opencode/.gitignore')
  }

  console.log()
  console.log(chalk.bold.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log(chalk.bold.green('  Join setup complete!'))
  console.log(chalk.bold.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log()
  console.log('  Your local environment is ready.')
  if (teamModels && Object.keys(teamModels).length > 0 && !hasUserOverride) {
    console.log(chalk.dim('  Tip: Run /make-user-model user <tier> current to override team models locally.'))
  }
  console.log(chalk.dim('  Restart opencode to pick up tier agent variants.'))
  console.log()
}