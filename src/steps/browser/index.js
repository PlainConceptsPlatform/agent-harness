import { execa } from 'execa'
import fse from 'fs-extra'
import { code, header, info, success, warn, error } from '../../utils/exec.js'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BROWSER_PRESET_PATH = path.resolve(__dirname, '../../presets/browser.json')
const browserPreset = await fse.readJson(BROWSER_PRESET_PATH)

export async function installBrowser(ctx = {}) {
  header('Step 9, Installing opencode-browser')

  const installScope = ctx.installScope || 'local'
  const locationAnswer = browserPreset.locationChoices?.[installScope] ?? browserPreset.locationChoices?.local ?? '2'

  const pendingTriggers = browserPreset.autoAnswers.map(a => ({
    ...a,
    response: a.response === '__LOCATION__' ? locationAnswer : a.response,
  }))

  let extensionPathShown = false

  try {
    const child = execa(browserPreset.installer.command, browserPreset.installer.args, {
      cwd: os.homedir(),
      stdio: ['pipe', 'pipe', 'pipe'],
      reject: false,
    })

    let show = false
    const triggers = [...pendingTriggers]

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()

      if (text.includes(browserPreset.output.showAfter)) show = true
      if (text.includes(browserPreset.output.hideAfter)) show = false

      if (show) process.stdout.write(chunk)

      // Detect the extension path from the installer output to show it clearly
      if (!extensionPathShown) {
        const pathMatch = text.match(/(C:\\[^\s]+(?:extension|opencode-browser[^\s]*))/i) ||
                          text.match(/((?:\/|~)[^\s]*(?:extension|opencode-browser[^\s]*))/i)
        if (pathMatch) {
          extensionPathShown = true
        }
      }

      for (let i = 0; i < triggers.length; i++) {
        if (text.includes(triggers[i].trigger)) {
          // When the installer asks to press Enter after loading the extension,
          // show the manual steps clearly before auto-answering
          if (triggers[i].trigger === browserPreset.output.hideAfter) {
            info('')
            warn('Manual step required: load the browser extension before pressing Enter')
            code([
              '1. Open chrome://extensions',
              '2. Enable Developer mode (top-right toggle)',
              '3. Click "Load unpacked"',
              '4. Select the extension folder shown above',
              '5. Pin the extension: open the Extensions menu (puzzle icon) and click the pin',
            ])
            info('Auto-confirming in 5 seconds...')
          }

          child.stdin.write(`${triggers[i].response}\n`)
          triggers.splice(i, 1)
          break
        }
      }
    })

    child.stderr.on('data', (chunk) => process.stderr.write(chunk))

    const result = await child

    if (result.exitCode === 0) {
      success('opencode-browser installed')
      if (extensionPathShown) {
        info('If you skipped loading the extension, run: npx @different-ai/opencode-browser@4.6.1 install')
      }
    } else {
      warn('opencode-browser install exited with non-zero code')
    }
  } catch (err) {
    error(`Failed to install opencode-browser: ${err.message}`)
  }
}
