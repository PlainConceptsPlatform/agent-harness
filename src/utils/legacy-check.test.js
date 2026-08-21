import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fse from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import { findLegacyInstall } from './legacy-check.js'

let cwd

beforeEach(() => {
  cwd = fse.mkdtempSync(path.join(os.tmpdir(), 'pc-legacy-'))
})

afterEach(() => {
  fse.removeSync(cwd)
})

describe('findLegacyInstall()', () => {
  it('returns null for a repo with no harness at all', async () => {
    expect(await findLegacyInstall(cwd)).toBeNull()
  })

  it('returns null for a v2 repo', async () => {
    await fse.outputJson(path.join(cwd, '.opencode', 'harness.json'), { version: 2 })
    expect(await findLegacyInstall(cwd)).toBeNull()
  })

  it('detects a v1 config file', async () => {
    await fse.outputJson(path.join(cwd, '.opencode', 'opencode-onboard.json'), { version: 2 })
    const found = await findLegacyInstall(cwd)
    expect(found.files).toContain('.opencode/opencode-onboard.json')
  })

  it('detects leftover ob- skills', async () => {
    await fse.ensureDir(path.join(cwd, '.agents', 'skills', 'ob-plan-apply'))
    await fse.ensureDir(path.join(cwd, '.agents', 'skills', 'pc-plan-goal'))
    const found = await findLegacyInstall(cwd)
    expect(found.skills).toEqual(['ob-plan-apply'])
  })

  // A v2 config wins: a repo that has already been migrated by hand may still
  // carry an ob- directory the user chose to keep, and must not be refused.
  it('ignores ob- skills once harness.json exists', async () => {
    await fse.outputJson(path.join(cwd, '.opencode', 'harness.json'), { version: 2 })
    await fse.ensureDir(path.join(cwd, '.agents', 'skills', 'ob-custom-loop'))
    expect(await findLegacyInstall(cwd)).toBeNull()
  })
})
