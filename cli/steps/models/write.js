import fse from 'fs-extra'
import { applyEdits, modify, parse } from 'jsonc-parser'
import path from 'path'
import { success, warn } from '../../utils/exec.js'

/**
 * Writes the selected build model as the default model in opencode.jsonc.
 * Per-tier models (plan/build/fast) are recorded in harness.json (models)
 * by the metadata step, then consumed by the agent-variant generator and /plan-apply.
 *
 * opencode tolerates JSONC (comments, trailing commas) in its config, so this
 * must not use readJson/writeJson: a strict parse crashes on valid configs and
 * a strict rewrite deletes user comments. jsonc-parser edits only the `model`
 * key and preserves the rest of the file byte-for-byte.
 */
export async function writeModelsToConfigs({ buildModel, keepExisting = false, cwd = process.cwd() }) {
  const opencodeJsonPath = path.join(cwd, 'opencode.jsonc')
  if (!await fse.pathExists(opencodeJsonPath)) return

  const text = await fse.readFile(opencodeJsonPath, 'utf-8')
  const errors = []
  parse(text, errors)
  if (errors.length > 0) {
    warn('opencode.jsonc could not be parsed: leaving it untouched. Set "model" manually.')
    return
  }

  // A model the repository already chose is its decision, not the wizard's: `update` used to
  // reset a deliberately pinned default to the build tier in every consumer it ran in.
  if (keepExisting && typeof parse(text)?.model === 'string') return

  // `undefined` removes the key; a string value sets it.
  const edits = modify(text, ['model'], buildModel || undefined, {
    formattingOptions: { insertSpaces: true, tabSize: 2 },
  })
  await fse.writeFile(opencodeJsonPath, applyEdits(text, edits), 'utf-8')
  if (buildModel) success(`default model -> ${buildModel} (written to opencode.jsonc)`)
}
