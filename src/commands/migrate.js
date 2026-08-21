import chalk from 'chalk'
import fse from 'fs-extra'
import path from 'node:path'
import { execa } from 'execa'
import { fileURLToPath } from 'node:url'
import { GENERATABLE_SKILLS, SKILL_RENAME } from '../steps/copy/skills.js'
import { header, info, success, warn } from '../utils/exec.js'
import { CONFIG_FILE, MANIFEST_FILE, OPENCODE_DIR, USER_CONFIG_FILE } from '../utils/paths.js'
import { exit } from '../utils/process.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTENT_SKILLS_DIR = path.resolve(__dirname, '../content/.agents/skills')

// State files, old name to new. The run-state file is deleted rather than moved:
// it is live wave state owned by the monitor plugin and is rebuilt on demand.
const STATE_MOVES = [
  ['opencode-onboard.json', CONFIG_FILE],
  ['opencode-onboard.user.json', USER_CONFIG_FILE],
  ['opencode-onboard-managed.json', MANIFEST_FILE],
]
const STATE_DELETES = ['.ob-run.json']

const TEXT_EXTENSIONS = new Set(['.md', '.mdx', '.json', '.jsonc', '.js', '.ts', '.tsx', '.yaml', '.yml', '.txt'])
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', 'coverage'])

// Archived OpenSpec changes are an audit trail: those proposals really did
// reference ob-* skills when they were written. Rewriting them would make the
// record say something that was never true, so the archive is left verbatim.
const ARCHIVE_SEGMENTS = ['openspec', 'changes', 'archive']

/**
 * The skills this package ships, expressed under the old `ob-` prefix.
 *
 * A shipped skill is safe to delete because `update` reinstalls it as `pc-*`
 * with current content, and that is strictly better than renaming a v1 copy we
 * would then have to convince the manifest to overwrite. Anything NOT in this
 * set is project-owned and must be renamed with its content intact.
 */
async function shippedLegacyNames() {
  const entries = await fse.readdir(CONTENT_SKILLS_DIR, { withFileTypes: true }).catch(() => [])
  const names = new Set()
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    // Platform variants install under a generic name, so both spellings ship.
    for (const name of [entry.name, SKILL_RENAME[entry.name]].filter(Boolean)) {
      if (name.startsWith('pc-')) names.add(`ob-${name.slice(3)}`)
    }
  }
  return names
}

/** Generated skills carry project content even though the placeholder ships. */
function isGeneratable(legacyName) {
  return GENERATABLE_SKILLS.has(`pc-${legacyName.slice(3)}`)
}

function isArchived(filePath) {
  // Split on both separators: path.join yields backslashes on Windows, and a
  // separator-blind check here would let the archive be rewritten there only.
  const parts = filePath.split(/[\\/]/)
  const at = parts.indexOf(ARCHIVE_SEGMENTS[0])
  if (at === -1) return false
  return ARCHIVE_SEGMENTS.every((segment, i) => parts[at + i] === segment)
}

async function collectTextFiles(dir, acc = []) {
  const entries = await fse.readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (isArchived(full)) continue
    if (entry.isDirectory()) {
      await collectTextFiles(full, acc)
    } else if (TEXT_EXTENSIONS.has(path.extname(entry.name)) || entry.name === '.gitignore') {
      acc.push(full)
    }
  }
  return acc
}

/**
 * Rewrite the identifiers v2 renamed.
 *
 * `\b` matters: a bare `ob-` also appears inside words such as `{blob-url}` in
 * the shipped GitHub ship fragment, and rewriting that silently corrupts the
 * command it belongs to.
 */
function rewriteIdentifiers(text) {
  return text
    .replace(/\bob-/g, 'pc-')
    .replace(/\bOB-/g, 'PC-')
    .replace(/opencode-onboard-managed\.json/g, MANIFEST_FILE)
    .replace(/opencode-onboard\.user\.json/g, USER_CONFIG_FILE)
    .replace(/opencode-onboard\.json/g, CONFIG_FILE)
    .replace(/@plainconceptsplatform\/opencode-onboard/g, '@plainconceptsplatform/agent-harness')
}

/** Base engineer templates and fullstack are subagents in v2. */
function demoteToSubagent(text) {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fm) return text
  if (!/^mode:\s*primary/m.test(fm[1])) return text
  const patched = fm[1].replace(/^mode:.*$/m, 'mode: subagent')
  return `---\n${patched}\n---${text.slice(fm[0].length)}`
}

async function isDirty(cwd) {
  const result = await execa('git', ['status', '--porcelain'], { cwd, reject: false })
  if (result.exitCode !== 0) return false
  return result.stdout.trim().length > 0
}

export async function planMigration(cwd = process.cwd()) {
  const opencodeDir = path.join(cwd, OPENCODE_DIR)
  const skillsDir = path.join(cwd, '.agents', 'skills')

  const moves = []
  for (const [from, to] of STATE_MOVES) {
    if (await fse.pathExists(path.join(opencodeDir, from))) moves.push([from, to])
  }
  const deletes = []
  for (const name of STATE_DELETES) {
    if (await fse.pathExists(path.join(opencodeDir, name))) deletes.push(name)
  }

  const shipped = await shippedLegacyNames()
  const entries = (await fse.readdir(skillsDir).catch(() => [])).filter(e => e.startsWith('ob-'))

  const skillsToRename = []
  const skillsToDrop = []
  for (const name of entries) {
    const stat = await fse.stat(path.join(skillsDir, name)).catch(() => null)
    if (!stat?.isDirectory()) continue
    // Generated content wins over "it ships": the placeholder shipped, the
    // 150-line project guardrails that replaced it did not.
    if (isGeneratable(name) || !shipped.has(name)) skillsToRename.push([name, `pc-${name.slice(3)}`])
    else skillsToDrop.push(name)
  }

  const agentsDir = path.join(cwd, OPENCODE_DIR, 'agents')
  const agentFiles = await fse.readdir(agentsDir).catch(() => [])
  const staleVariants = agentFiles.filter(f => /^[\w-]+-engineer\.(build|fast|plan)\.md$/.test(f))

  // Plugins and the TUI panel are shipped code, and update installs the pc-*
  // copies alongside rather than over the ob-* ones. Left in place, both
  // generations load: two tier plugins writing the same variant files and two
  // monitors writing the same run state.
  const stalePlugins = []
  for (const dir of ['plugins', 'tui']) {
    const full = path.join(cwd, OPENCODE_DIR, dir)
    for (const file of await fse.readdir(full).catch(() => [])) {
      if (file.startsWith('ob-')) stalePlugins.push(path.join(dir, file))
    }
  }

  return { moves, deletes, skillsToRename, skillsToDrop, staleVariants, stalePlugins }
}

export async function runMigrate({ cwd = process.cwd(), force = false, dryRun = false } = {}) {
  header('Migrating from opencode-onboard v1')

  const opencodeDir = path.join(cwd, OPENCODE_DIR)
  if (await fse.pathExists(path.join(opencodeDir, CONFIG_FILE))) {
    success(`${OPENCODE_DIR}/${CONFIG_FILE} already exists: this project is already on v2.`)
    return { migrated: false, alreadyV2: true }
  }
  if (!await fse.pathExists(path.join(opencodeDir, 'opencode-onboard.json'))) {
    warn(`No ${OPENCODE_DIR}/opencode-onboard.json found: nothing to migrate.`)
    return { migrated: false }
  }

  // The migration rewrites files in place across the repo. A clean tree means
  // `git checkout .` is always a complete undo.
  if (!force && !dryRun && await isDirty(cwd)) {
    warn('Working tree has uncommitted changes.')
    warn('Commit or stash them first so this migration can be reverted with `git checkout .`, or pass --force.')
    return { migrated: false, dirty: true }
  }

  const plan = await planMigration(cwd)

  for (const [from, to] of plan.moves) info(`${from} -> ${to}`)
  for (const name of plan.deletes) info(`${name} -> removed (rebuilt on demand)`)
  for (const [from, to] of plan.skillsToRename) info(`${from}/ -> ${to}/ (content kept)`)
  if (plan.skillsToDrop.length > 0) {
    info(`${plan.skillsToDrop.length} shipped skill(s) removed, reinstalled as pc-* by update`)
  }
  if (plan.staleVariants.length > 0) {
    info(`${plan.staleVariants.length} tier variant(s) removed, regenerated at startup`)
  }
  if (plan.stalePlugins.length > 0) {
    info(`${plan.stalePlugins.length} ob- plugin/tui file(s) removed, replaced by pc-* on update`)
  }

  if (dryRun) {
    console.log()
    info('Dry run: nothing written.')
    return { migrated: false, dryRun: true, plan }
  }

  // 1. State files. The manifest keeps its hashes; only its keys are renamed,
  //    so update still recognizes untouched files and refreshes them.
  for (const [from, to] of plan.moves) {
    const fromPath = path.join(opencodeDir, from)
    const toPath = path.join(opencodeDir, to)
    if (to === MANIFEST_FILE) {
      const manifest = await fse.readJson(fromPath).catch(() => null)
      if (manifest?.files && typeof manifest.files === 'object') {
        manifest.files = Object.fromEntries(
          Object.entries(manifest.files).map(([key, value]) => [rewriteIdentifiers(key), value]),
        )
      }
      await fse.writeJson(toPath, manifest ?? { version: 1, files: {} }, { spaces: 2 })
      await fse.remove(fromPath)
    } else {
      await fse.move(fromPath, toPath, { overwrite: true })
    }
  }
  for (const name of plan.deletes) await fse.remove(path.join(opencodeDir, name))

  // 2. Skills: rename what holds project content, drop what update reinstalls.
  const skillsDir = path.join(cwd, '.agents', 'skills')
  for (const [from, to] of plan.skillsToRename) {
    await fse.move(path.join(skillsDir, from), path.join(skillsDir, to), { overwrite: true })
  }
  for (const name of plan.skillsToDrop) await fse.remove(path.join(skillsDir, name))

  // 3. Stale tier variants: the plugin rebuilds these from the base templates.
  const agentsDir = path.join(opencodeDir, 'agents')
  for (const file of plan.staleVariants) await fse.remove(path.join(agentsDir, file))

  // 3b. Stale plugins and TUI panel, so only one generation loads.
  for (const relative of plan.stalePlugins) await fse.remove(path.join(opencodeDir, relative))

  // 4. Rewrite identifiers everywhere that survives, so preserved skills and
  //    custom agents stop pointing at names that no longer exist.
  let rewritten = 0
  // .github/workflows is included because GitHub Agentic Workflow definitions
  // call the skills by name (skill("pc-repo-audit")), so a stale ob- name there
  // fails at run time in CI rather than locally. Their compiled .lock.yml files
  // embed the same prompt text, so recompile with `gh aw compile` afterwards.
  for (const dir of [skillsDir, opencodeDir, path.join(cwd, 'openspec'), path.join(cwd, '.github', 'workflows')]) {
    if (!await fse.pathExists(dir)) continue
    for (const file of await collectTextFiles(dir)) {
      const before = await fse.readFile(file, 'utf-8')
      const after = rewriteIdentifiers(before)
      if (after !== before) {
        await fse.writeFile(file, after, 'utf-8')
        rewritten++
      }
    }
  }
  for (const name of ['AGENTS.md', 'ARCHITECTURE.md', 'DESIGN.md', 'opencode.jsonc', 'opencode.json']) {
    const file = path.join(cwd, name)
    if (!await fse.pathExists(file)) continue
    const before = await fse.readFile(file, 'utf-8')
    const after = rewriteIdentifiers(before)
    if (after !== before) {
      await fse.writeFile(file, after, 'utf-8')
      rewritten++
    }
  }

  // 5. Engineers become subagents; build and plan are the only primaries now.
  //    The plugin also does this at startup, but doing it here keeps the
  //    migration commit self-consistent.
  let demoted = 0
  for (const file of await fse.readdir(agentsDir).catch(() => [])) {
    if (!file.endsWith('.md')) continue
    const full = path.join(agentsDir, file)
    const before = await fse.readFile(full, 'utf-8')
    const after = demoteToSubagent(before)
    if (after !== before) {
      await fse.writeFile(full, after, 'utf-8')
      demoted++
    }
  }

  success(`Renamed ${plan.moves.length} state file(s), kept ${plan.skillsToRename.length} project-owned skill(s)`)
  success(`Rewrote identifiers in ${rewritten} file(s), demoted ${demoted} agent(s) to subagent`)
  if (plan.stalePlugins.length > 0) {
    success(`Removed ${plan.stalePlugins.length} superseded plugin/tui file(s)`)
  }
  console.log()
  console.log(chalk.bold('Next: run update to install the current harness.'))
  console.log(chalk.dim('  npx @plainconceptsplatform/agent-harness@latest update'))

  // The .md definitions were rewritten above, but the compiled .lock.yml files
  // embed the same prompt text and are what CI actually runs.
  if (await fse.pathExists(path.join(cwd, '.github', 'workflows'))) {
    const locks = (await fse.readdir(path.join(cwd, '.github', 'workflows')).catch(() => []))
      .filter(f => f.endsWith('.lock.yml'))
    if (locks.length > 0) {
      console.log()
      console.log(chalk.bold(`Then recompile ${locks.length} agentic workflow(s), whose .lock.yml still holds the old skill names:`))
      console.log(chalk.dim('  gh aw compile'))
    }
  }

  return { migrated: true, plan, rewritten, demoted }
}

export async function runMigrateCommand(args = []) {
  const result = await runMigrate({
    force: args.includes('--force'),
    dryRun: args.includes('--dry-run'),
  })
  if (result.dirty) exit(1)
  return result
}
