import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import fse from 'fs-extra'
import { patchArchiveCommand, patchOpsShip } from './commands.js'

// The archive procedure lives in the pc-plan-archive skill (the /plan-archive
// command is a thin wrapper that loads it), so platform content is injected
// into the installed SKILL.md.
const SKILL_REL_PATH = path.join('.agents', 'skills', 'pc-plan-archive', 'SKILL.md')

describe('platform patching', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-patch-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  })

  async function copySkillTemplate() {
    const source = path.join(process.cwd(), 'src', 'content', SKILL_REL_PATH)
    const dest = path.join(tmpDir, SKILL_REL_PATH)
    await fse.ensureDir(path.dirname(dest))
    await fse.copyFile(source, dest)
    return dest
  }

  // The GitHub ops-ship fragment carries a $'...' shell-quoted --body argument.
  // A replacement string expands $' as "everything after the match", so this
  // used to inject a bare `--body` with the whole screenshot payload deleted.
  it('keeps shell $-quoting intact when injecting ops-ship', async () => {
    const rel = path.join('.agents', 'skills', 'pc-ops-ship', 'SKILL.md')
    const dest = path.join(tmpDir, rel)
    await fse.ensureDir(path.dirname(dest))
    await fse.copyFile(path.join(process.cwd(), 'src', 'content', rel), dest)

    await patchOpsShip('github', tmpDir)

    const content = await fse.readFile(dest, 'utf-8')
    const line = content.split('\n').find(l => l.includes('gh pr comment'))
    expect(line).toContain('{blob-url}')
    expect(line).toContain('## Screenshots')
    expect(line).not.toMatch(/--body\s*$/)
  })

  it('patches pc-plan-archive skill for azure platform', async () => {
    const dest = await copySkillTemplate()

    await patchArchiveCommand('azure', tmpDir)

    const content = await fse.readFile(dest, 'utf-8')
    expect(content).toContain('az repos pr list --repository {repo} --status completed')
    expect(content).not.toContain('gh pr list --repo {owner}/{repo} --state merged')
  })

  it('patches pc-plan-archive skill for github platform', async () => {
    const dest = await copySkillTemplate()

    await patchArchiveCommand('github', tmpDir)

    const content = await fse.readFile(dest, 'utf-8')
    expect(content).toContain('gh pr list --repo {owner}/{repo} --state merged')
    expect(content).not.toContain('az repos pr list --repository {repo} --status completed')
  })

  it('patches pc-plan-archive skill for none platform without throwing', async () => {
    const dest = await copySkillTemplate()

    await patchArchiveCommand('none', tmpDir)

    const content = await fse.readFile(dest, 'utf-8')
    expect(content).toContain('No PR is created in this mode')
    expect(content).not.toContain('gh pr list --repo {owner}/{repo} --state merged')
    expect(content).not.toContain('az repos pr list --repository {repo} --status completed')
  })

  it('patches pc-plan-archive skill for gitlab platform', async () => {
    const dest = await copySkillTemplate()

    await patchArchiveCommand('gitlab', tmpDir)

    const content = await fse.readFile(dest, 'utf-8')
    // glab has no `--state merged` / `--json <fields>`: the preset uses the
    // real syntax (`--merged --output json`); keep this assertion in sync.
    expect(content).toContain('glab mr list --repo {owner}/{repo} --merged --output json')
    expect(content).toContain('glab mr create')
    expect(content).not.toContain('gh pr list --repo {owner}/{repo} --state merged')
    expect(content).not.toContain('az repos pr list --repository {repo} --status completed')
  })
})
