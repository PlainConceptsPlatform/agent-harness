import chalk from 'chalk'
import { execa } from 'execa'
import fse from 'fs-extra'
import path from 'node:path'
import { parse as parseJsonc } from 'jsonc-parser'
import { installBrowser } from '../steps/browser/index.js'
import { OPENCODE_QUOTA_PACKAGE } from '../steps/copy/opencode-json.js'
import { checkRtk } from '../steps/optimization/index.js'
import { checkPlatform } from '../steps/platform/index.js'
import { commandExists, header, info, loading, success, warn } from '../utils/exec.js'
import { IGNORED_ENTRIES, USER_CONFIG_FILE } from '../utils/paths.js'
import { readHarnessConfig } from './shared.js'

export async function runJoin() {
  const logo = chalk.hex('#fe3d57')
  console.log()
  console.log(logo('  🤝 agent-harness join'))
  console.log(chalk.dim('  New team member setup: checks & local installs only.'))
  console.log(chalk.dim('  Does not modify committed project files.'))
  console.log()

  const saved = await readHarnessConfig()

  if (!saved) {
    warn('No .opencode/harness.json found.')
    warn('This project may not have been onboarded yet. Run `npx @plainconceptsplatform/agent-harness` first.')
    return
  }

  const backlogPlatform = saved?.platform?.backlog
  const repoPlatform = saved?.platform?.repo
  const teamModels = saved?.models ?? {}

  const opencodeDir = path.join(process.cwd(), '.opencode')
  const opencodeJsonPath = path.join(process.cwd(), 'opencode.jsonc')

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
    // `reject: false` made the catch below unreachable: a failed install exited
    // non-zero without throwing, so this reported success while the plugin's
    // dependency was missing and every plugin silently refused to load. Let the
    // call reject, and confirm the dependency is actually on disk before saying so.
    const declared = Object.keys(
      parseJsonc(await fse.readFile(pkgPath, 'utf8'))?.dependencies ?? {},
    )
    // opencode-quota 5.x declares @opencode/plugin 2.0.16 exactly. The harness
    // pins 2.0.22 because the notifier needs >=2.0.18, so npm sees a peer
    // conflict and aborts the whole install, leaving every plugin uninstalled.
    // The quota plugin runs fine on 2.0.22; relax peer resolution when it is
    // present. Everything the plugins import is declared in package.json, so
    // npm does not need to install peers on our behalf.
    const installArgs = declared.includes(OPENCODE_QUOTA_PACKAGE)
      ? ['install', '--legacy-peer-deps']
      : ['install']
    try {
      await execa('npm', installArgs, { cwd: opencodeDir, stdio: 'pipe' })
    } catch (err) {
      warn('npm install failed in .opencode/: plugins may not load correctly')
      if (err?.stderr) info(String(err.stderr).trim().split('\n').slice(-3).join('\n'))
    }
    const missing = declared.filter(
      name => !fse.pathExistsSync(path.join(opencodeDir, 'node_modules', ...name.split('/'))),
    )
    if (missing.length === 0) {
      success('OpenCode plugins installed')
    } else {
      warn(`These dependencies are still missing from .opencode/node_modules: ${missing.join(', ')}`)
      warn('Plugins that import them will not load. Re-run `npm install` there once the registry is reachable.')
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
      const errors = []
      cfg = parseJsonc(await fse.readFile(opencodeJsonPath, 'utf-8'), errors)
      if (errors.length > 0) cfg = {}
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

  // Step 8: Browser automation
  header('Step 8, Installing agent-browser')
  await installBrowser()

  // Step 9: Model tier guidance
  header('Step 9, Model tiers')
  const userConfigPath = path.join(opencodeDir, USER_CONFIG_FILE)
  const hasUserOverride = await fse.pathExists(userConfigPath)

  if (teamModels && Object.keys(teamModels).length > 0) {
    info('Team model configuration:')
    for (const [tier, model] of Object.entries(teamModels)) {
      info(`  ${tier}: ${model}`)
    }
    console.log()

    if (hasUserOverride) {
      info('You have a local model override (harness.user.json).')
      info('To change: /make-user-model user <tier> <model>')
    } else {
      info('No local override: using team defaults.')
      info('To override a tier for your machine: /make-user-model user <tier> <model>')
      info('  e.g. /make-user-model user build current')
    }
    console.log()
    info('The pc-subagent-tiers plugin will generate *-engineer.<tier>.md variants')
    info('on opencode startup from these model configs.')
  } else {
    warn('No model tiers configured in harness.json.')
    warn('Run /make-user-model <tier> <model> for plan, build, and fast.')
  }

  // Step 10: Ensure .opencode/.gitignore exists
  header('Step 10, Checking .opencode/.gitignore')
  const gitignorePath = path.join(opencodeDir, '.gitignore')
  const requiredEntries = IGNORED_ENTRIES

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
