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
  header('Step 9, Installing browse')

  try {
    const install = await execa(browserPreset.installer.command, browserPreset.installer.args, {
      cwd: os.homedir(),
      reject: false,
    })

    if (install.exitCode !== 0) {
      warn('browse npm install exited with non-zero code')
      if (install.stderr) info(install.stderr)
      return
    }
    success('browse installed')
  } catch (err) {
    error(`Failed to install browse: ${err.message}`)
    return
  }

  try {
    const setup = await execa(browserPreset.setup.command, browserPreset.setup.args, {
      cwd: os.homedir(),
      reject: false,
      timeout: 180000,
    })

    if (setup.exitCode === 0) {
      success('browse paired with your browser')
      if (setup.stdout) info(setup.stdout.trim())
    } else {
      // browse install opens the Chrome Web Store and waits for the extension to connect.
      // A non-zero exit often just means the user didn't finish pairing in time; browse is
      // still installed and usable once they add the extension and run `browse pair`.
      warn('browse setup did not complete — install the extension and run `browse pair`')
      if (setup.stderr) info(setup.stderr)
    }
  } catch (err) {
    error(`Failed to set up browse: ${err.message}`)
  }
}
