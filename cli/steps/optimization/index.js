import { checkbox, confirm } from '@inquirer/prompts'
import { execa } from 'execa'
import fse from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { code, commandExists, header, info, loading, success, warn } from '../../utils/exec.js'
import { installQuota } from './quota.js'
import { installSimpleEnglish } from './simple-english.js'
import { installCodegraph } from './codegraph.js'
import { installMemory } from './memory.js'
import { installHumanizer } from './humanizer.js'
import { patchGuardrails } from './patch-guardrails.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OPTIMIZATION_PRESET_PATH = path.resolve(__dirname, '../../presets/optimization.json')
const optimizationPreset = await fse.readJson(OPTIMIZATION_PRESET_PATH)

export async function checkRtk(options = {}) {
  if (!options.skipHeader) header('Checking rtk')

  let shouldCheck = true
  if (!options.skipPrompt) {
    info('Recommended: install and verify rtk for safer agent CLI command execution.')
    shouldCheck = await confirm({
      message: 'Check rtk now?',
      default: true,
    })
  }

  if (!shouldCheck) {
    warn('Skipped rtk check (you can install it later)')
    return { optedIn: false, checked: false, available: false }
  }

  loading('checking rtk...')

  const available = await commandExists('rtk')

  if (available) {
    success('rtk is available')
    return { optedIn: true, checked: true, available: true }
  }

  warn('rtk not found on PATH.')
  console.log()
  info('rtk is required for agents to run CLI commands safely.')
  info('Install it from: https://github.com/rtk-ai/rtk#pre-built-binaries')
  console.log()
  info('After installing, verify with:')
  code(['rtk --version'])
  return { optedIn: true, checked: true, available: false }
}

export async function tokenOptimizationStep(options = {}) {
  header('Step 8, Token optimization tools')

  const defaultSelected = optimizationPreset.choices
    .filter(choice => choice.checked)
    .map(choice => choice.value)
  let selected = defaultSelected

  if (!options.skipPrompt && process.stdin.isTTY) {
    info(optimizationPreset.info)
    // Abort the prompt via signal instead of racing it: a raced prompt keeps
    // stdin in raw mode after "losing" and rejects unhandled on a later Ctrl+C.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), optimizationPreset.timeoutMs)
    try {
      selected = await checkbox(
        {
          message: optimizationPreset.message,
          choices: optimizationPreset.choices,
        },
        { signal: controller.signal },
      )
    } catch (err) {
      if (err.name !== 'AbortPromptError') throw err
      selected = defaultSelected
      info('No response: continuing with the recommended defaults.')
    } finally {
      clearTimeout(timer)
    }
  }

  loading('applying token optimization selections...')

  const installScope = options.ctx?.installScope || 'local'

  const has = value => selected.includes(value)

  const rtk = has('rtk')
    ? await checkRtk({ skipHeader: true, skipPrompt: true })
    : { optedIn: false, checked: false, available: false }

  const quota = has('quota')
    ? await installQuota({ skipHeader: true, skipPrompt: true })
    : { optedIn: false, installed: false }

  const simpleEnglish = has('simpleEnglish')
    ? await installSimpleEnglish({
      skipHeader: true,
      skipPrompt: true,
      installScope,
    })
    : { optedIn: false, installed: false }

  const codegraph = has('codegraph')
    ? await installCodegraph({ skipHeader: true, installScope })
    : { optedIn: false, installed: false }

  const memory = has('memory')
    ? await installMemory({ skipHeader: true })
    : { optedIn: false, installed: false }

  const humanizer = has('humanizer')
    ? await installHumanizer({ skipHeader: true, installScope })
    : { optedIn: false, installed: false }

  // Run a single npx skills experimental_install to pick up all skills
  // that were added to skills-lock.json by the individual installers above.
  await syncSkillsLock()

  // Patch guardrails skill with selected tool guidance sections
  await patchGuardrails({
    rtk: rtk.available,
    codegraph: codegraph.optedIn,
    memory: memory.optedIn,
    simpleEnglish: simpleEnglish.installed,
    humanizer: humanizer.optedIn,
  })

  if (selected.length === 0) warn('No token optimization tools selected')
  else success('Token optimization step completed')

  return { rtk, quota, simpleEnglish, codegraph, memory, humanizer }
}

async function syncSkillsLock() {
  const destLock = path.join(process.cwd(), 'skills-lock.json')
  if (!await fse.pathExists(destLock)) {
    info('No skills-lock.json found, skipping skills sync')
    return
  }

  loading('syncing skills via npx skills experimental_install...')
  try {
    const result = await execa('npx', ['skills', 'experimental_install', '--yes'], {
      cwd: process.cwd(),
      reject: false,
      stdio: 'pipe',
      timeout: 600000,
    })

    if (result.exitCode === 0) {
      success('Skills synced from skills-lock.json')
    } else {
      const errLine = result.stderr?.trim().split('\n').slice(-3).join('\n')
      warn(`npx skills experimental_install exited with non-zero code${errLine ? `: ${errLine}` : ''}`)
    }
  } catch (err) {
    warn(`npx skills experimental_install failed: ${err.message}`)
  }
}
