import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

import { execa } from 'execa'
import { ensureGitLongpaths, readHarnessConfig } from './shared.js'

describe('readHarnessConfig()', () => {
  let tmpDir, originalCwd

  beforeEach(() => {
    vi.clearAllMocks()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-test-'))
    originalCwd = process.cwd()
    process.chdir(tmpDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns null when config file does not exist', async () => {
    const result = await readHarnessConfig()

    expect(result).toBeNull()
  })

  it('returns parsed config when file exists', async () => {
    const configDir = path.join(tmpDir, '.opencode')
    fs.mkdirSync(configDir)
    fs.writeFileSync(
      path.join(configDir, 'harness.json'),
      JSON.stringify({ version: 2, platform: { repo: 'github' } }),
      'utf-8'
    )

    const result = await readHarnessConfig()

    expect(result).not.toBeNull()
    expect(result.version).toBe(2)
    expect(result.platform.repo).toBe('github')
  })

  it('returns null when file contains invalid JSON', async () => {
    const configDir = path.join(tmpDir, '.opencode')
    fs.mkdirSync(configDir)
    fs.writeFileSync(
      path.join(configDir, 'harness.json'),
      'not valid json',
      'utf-8'
    )

    const result = await readHarnessConfig()

    expect(result).toBeNull()
  })
})

describe('ensureGitLongpaths()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('configures core.longpaths in a git repository', async () => {
    execa
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'true' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })

    const result = await ensureGitLongpaths('C:/repo')

    expect(result).toBe(true)
    expect(execa).toHaveBeenNthCalledWith(1, 'git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: 'C:/repo',
      reject: false,
    })
    expect(execa).toHaveBeenNthCalledWith(2, 'git', ['config', 'core.longpaths', 'true'], {
      cwd: 'C:/repo',
      reject: false,
    })
  })

  it('skips configuration outside a git repository', async () => {
    execa.mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: '' })

    const result = await ensureGitLongpaths('C:/not-a-repo')

    expect(result).toBe(false)
    expect(execa).toHaveBeenCalledTimes(1)
  })
})
