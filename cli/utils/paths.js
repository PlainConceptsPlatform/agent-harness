import os from 'node:os'
import path from 'node:path'

/**
 * Every harness path that lands in a consumer repo, in one place.
 *
 * These filenames are a contract with every repo the harness has been
 * installed into: the CLI writes them, and the opencode plugins shipped in
 * harness/.opencode/plugins/ read them back at runtime. Changing a name
 * here means changing it in that payload too, or the plugins go blind.
 *
 * They are deliberately named for the harness rather than for the CLI, so a
 * future rename of the package does not become a rename of the on-disk state.
 */
export const OPENCODE_DIR = '.opencode'

/** Project config written by the metadata step. */
export const CONFIG_FILE = 'harness.json'

/** Per-developer model override, gitignored, never committed. */
export const USER_CONFIG_FILE = 'harness.user.json'

/** Hashes of every managed file, so `update` can detect local edits. */
export const MANIFEST_FILE = 'harness-managed.json'

/** Live subagent wave state, owned by the pc-subagent-monitor plugin. */
export const RUN_STATE_FILE = 'harness-run.json'

/** Names `.opencode/.gitignore` must cover. Mirrored in content/.opencode/_gitignore. */
export const IGNORED_ENTRIES = [
  'node_modules',
  RUN_STATE_FILE,
  USER_CONFIG_FILE,
  MANIFEST_FILE,
  'source-roots.json',
  '*-engineer.*.md',
  // Regenerated from fullstack-engineer.md by pc-subagent-tiers every startup.
  'agents/build.md',
  'agents/plan.md',
]

export function configPath(cwd = process.cwd()) {
  return path.join(cwd, OPENCODE_DIR, CONFIG_FILE)
}

export function userConfigPath(cwd = process.cwd()) {
  return path.join(cwd, OPENCODE_DIR, USER_CONFIG_FILE)
}

export function manifestPath(cwd = process.cwd()) {
  return path.join(cwd, OPENCODE_DIR, MANIFEST_FILE)
}

/** Cross-run models cache, keyed to the CLI rather than to any one repo. */
export function modelsCacheDir() {
  return path.join(os.homedir(), '.config', 'agent-harness')
}

/**
 * Filenames written by opencode-onboard v1.x. Only used to detect a v1 repo
 * and refuse to half-patch it: nothing reads their contents.
 */
export const LEGACY_CONFIG_FILES = [
  'opencode-onboard.json',
  'opencode-onboard.user.json',
  'opencode-onboard-managed.json',
]
