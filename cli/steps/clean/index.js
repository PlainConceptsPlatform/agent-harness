import { checkbox } from '@inquirer/prompts'
import fse from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { findAiFiles } from '../../utils/copy.js'
import { header, info, success, warn } from '../../utils/exec.js'
import { MARKERS } from '../../utils/terminal.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLEAN_PRESET_PATH = path.resolve(__dirname, '../../presets/clean.json')
const cleanPreset = await fse.readJson(CLEAN_PRESET_PATH)

async function childrenExcludingPreserved(dir) {
  const results = []
  if (!await fse.pathExists(dir)) return results
  const entries = await fse.readdir(dir)
  for (const entry of entries) {
    if (cleanPreset.preserveSubfolders.includes(entry)) continue
    results.push(path.join(dir, entry))
  }
  return results
}

async function isPopulated(filePath) {
  if (!await fse.pathExists(filePath)) return false
  const content = await fse.readFile(filePath, 'utf-8')
  const trimmed = content.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('<!-- onboard-prompt')) return false
  return true
}

async function hasOpenspecHistory(cwd) {
  const changesDir = path.join(cwd, 'openspec', 'changes')
  const archiveDir = path.join(cwd, 'openspec', 'archive')
  if (await fse.pathExists(changesDir)) {
    const entries = await fse.readdir(changesDir)
    if (entries.length > 0) return true
  }
  if (await fse.pathExists(archiveDir)) {
    const entries = await fse.readdir(archiveDir)
    if (entries.length > 0) return true
  }
  return false
}

export async function cleanAiFiles({ removeLegacyConfig = false } = {}) {
  header('Step 2, Existing AI config files')

  const cwd = process.cwd()
  const ctx = {
    hasDesign: await isPopulated(path.join(cwd, 'DESIGN.md')),
    hasArchitecture: await isPopulated(path.join(cwd, 'ARCHITECTURE.md')),
    hasOpenspec: await hasOpenspecHistory(cwd),
  }

  if (ctx.hasDesign) info('DESIGN.md exists and is populated, keeping it')
  if (ctx.hasArchitecture) info('ARCHITECTURE.md exists and is populated, keeping it')
  if (ctx.hasOpenspec) info('openspec/ history exists, keeping it')

  const legacyConfig = path.join(cwd, '.opencode', 'opencode.json')
  if (removeLegacyConfig && await fse.pathExists(legacyConfig)) {
    await fse.remove(legacyConfig)
    info('Removed legacy .opencode/opencode.json')
  }

  const flatFiles = await findAiFiles(cwd, cleanPreset.detectFiles)
  const dirTargets = cleanPreset.directoryTargets
  const dirEntries = []
  for (const dirName of dirTargets) {
    const dirPath = path.join(cwd, dirName)
    const children = await childrenExcludingPreserved(dirPath)
    if (children.length > 0) {
      dirEntries.push(...children)
    } else if (await fse.pathExists(dirPath)) {
      // Directory exists but all children are preserved (e.g. only skills/):
      // still offer the directory itself as a removable option.
      dirEntries.push(dirPath)
    }
  }

  const filteredFlat = flatFiles.filter(f => {
    const rel = path.relative(cwd, f)
    if (dirTargets.includes(rel)) return false
    if (cleanPreset.preserve.some(p => rel === p || rel.startsWith(p + path.sep))) return false
    return true
  })

  const allToRemove = [...filteredFlat, ...dirEntries]

  if (allToRemove.length === 0) {
    success('No existing AI config files to remove')
    return ctx
  }

  const choices = allToRemove.map(f => ({
    name: path.relative(cwd, f).replace(/\\/g, '/'),
    value: f,
    checked: true,
  }))

  const selected = await checkbox({
    message: cleanPreset.selectionMessage,
    choices,
  })

  if (!selected || selected.length === 0) {
    success('No AI config files selected for removal')
    return ctx
  }

  warn('Removing selected AI config files:')
  for (const f of selected) {
    info(`${MARKERS.EMPTY}${f.replace(cwd + path.sep, '')}`)
    await fse.remove(f)
  }
  success('Removed existing AI config files')

  return ctx
}
