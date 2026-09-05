import { execa } from 'execa'
import fse from 'fs-extra'
import { header, info, success, warn, error } from '../../utils/exec.js'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BROWSER_PRESET_PATH = path.resolve(__dirname, '../../presets/browser.json')
const browserPreset = await fse.readJson(BROWSER_PRESET_PATH)

export async function installBrowser() {
  header('Step 9, Installing agent-browser')

  try {
    const install = await execa(browserPreset.installer.command, browserPreset.installer.args, {
      cwd: os.homedir(),
      reject: false,
    })

    if (install.exitCode !== 0) {
      warn('agent-browser npm install exited with non-zero code')
      if (install.stderr) info(install.stderr)
      return
    }
    success('agent-browser installed')
  } catch (err) {
    error(`Failed to install agent-browser: ${err.message}`)
    return
  }

  try {
    const chrome = await execa(browserPreset.chromeSetup.command, browserPreset.chromeSetup.args, {
      cwd: os.homedir(),
      reject: false,
    })

    if (chrome.exitCode === 0) {
      success('agent-browser Chrome ready')
      if (chrome.stdout) info(chrome.stdout.trim())
    } else {
      warn('agent-browser install (Chrome setup) exited with non-zero code')
      if (chrome.stderr) info(chrome.stderr)
    }
  } catch (err) {
    error(`Failed to set up Chrome for agent-browser: ${err.message}`)
  }
}
