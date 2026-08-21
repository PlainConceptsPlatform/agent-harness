import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

vi.mock('../../utils/exec.js', () => ({
  header: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

vi.mock('fs-extra', () => ({
  default: {
    ensureDir: vi.fn().mockResolvedValue(undefined),
    writeJson: vi.fn().mockResolvedValue(undefined),
    // default: no existing file -> rejects so the merge falls back to defaults
    readJson: vi.fn().mockRejectedValue(new Error('ENOENT')),
  },
}))

import { execa } from 'execa'
import fse from 'fs-extra'
import { writeHarnessConfig } from './index.js'

function lastPayload() {
  const call = fse.writeJson.mock.calls[0]
  return call[1]
}

describe('writeHarnessConfig()', () => {
  let tmpDir

  beforeEach(() => {
    vi.clearAllMocks()
    fse.readJson.mockRejectedValue(new Error('ENOENT'))
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes JSON file with all selections', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: '1.2.3', stderr: '' })

    await writeHarnessConfig({
      backlogPlatform: 'github',
      repoPlatform: 'github',
      sourceMode: 'current',
      sourceRoots: ['/test/path'],
      hasDesign: true,
      hasArchitecture: false,
      hasOpenspec: true,
      maxConcurrentAgents: 4,
      planModel: 'plan-model',
      buildModel: 'build-model',
      fastModel: 'fast-model',
      optionalTools: { rtk: { optedIn: true }, simpleEnglish: { optedIn: true } },
      cwd: tmpDir,
    })

    expect(fse.ensureDir).toHaveBeenCalled()
    expect(fse.writeJson).toHaveBeenCalled()
    const payload = lastPayload()
    expect(payload.version).toBe(2)
    expect(payload.platform.backlog).toBe('github')
    expect(payload.platform.repo).toBe('github')
    expect(payload.models.build).toBe('build-model')
    expect(payload.agents.maxConcurrent).toBe(4)
    expect(payload.tools.rtk).toBe(true)
    expect(payload.tools.simpleEnglish).toBe(true)
    expect(payload.preexisting.design).toBe(true)
    expect(payload.preexisting.architecture).toBe(false)
    expect(payload.preexisting.openspec).toBe(true)
  })

  it('writes mixed platforms (azure backlog + github repo)', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: '1.2.3', stderr: '' })

    await writeHarnessConfig({
      backlogPlatform: 'azure',
      repoPlatform: 'github',
      sourceMode: 'current',
      sourceRoots: [],
      cwd: tmpDir,
    })

    const payload = lastPayload()
    expect(payload.platform.backlog).toBe('azure')
    expect(payload.platform.repo).toBe('github')
  })

  it('detects opencode version from CLI', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: '2.0.0', stderr: '' })
    await writeHarnessConfig({ backlogPlatform: 'github', repoPlatform: 'github', sourceMode: 'current', sourceRoots: [], cwd: tmpDir })
    expect(lastPayload().opencodeVersion).toBe('2.0.0')
  })

  it('handles missing opencode gracefully', async () => {
    execa.mockResolvedValue({ exitCode: 1, stdout: '', stderr: '' })
    await writeHarnessConfig({ backlogPlatform: 'github', repoPlatform: 'github', sourceMode: 'current', sourceRoots: [], cwd: tmpDir })
    expect(lastPayload().opencodeVersion).toBe(null)
  })

  it('does not include wizard wrapper or note', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: '1', stderr: '' })
    await writeHarnessConfig({ backlogPlatform: 'github', repoPlatform: 'github', sourceMode: 'current', sourceRoots: [], cwd: tmpDir })
    const payload = lastPayload()
    expect(payload.wizard).toBeUndefined()
    expect(payload.note).toBeUndefined()
  })

  it('persists none as an explicit platform mode', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: '1', stderr: '' })
    await writeHarnessConfig({ backlogPlatform: 'none', repoPlatform: 'none', sourceMode: 'current', sourceRoots: [], cwd: tmpDir })
    expect(lastPayload().platform.backlog).toBe('none')
    expect(lastPayload().platform.repo).toBe('none')
  })

  it('omits models when no model is selected and none exists', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: '1', stderr: '' })
    await writeHarnessConfig({ backlogPlatform: 'github', repoPlatform: 'github', sourceMode: 'current', sourceRoots: [], cwd: tmpDir })
    expect(lastPayload().models).toBeUndefined()
  })

  it('defaults maxConcurrent to 3 when unset', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: '1', stderr: '' })
    await writeHarnessConfig({ backlogPlatform: 'github', repoPlatform: 'github', sourceMode: 'current', sourceRoots: [], cwd: tmpDir })
    expect(lastPayload().agents.maxConcurrent).toBe(3)
  })

  it('clamps maxConcurrent to the 1..5 range', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: '1', stderr: '' })

    await writeHarnessConfig({ backlogPlatform: 'github', repoPlatform: 'github', sourceMode: 'current', sourceRoots: [], maxConcurrentAgents: 9, cwd: tmpDir })
    expect(lastPayload().agents.maxConcurrent).toBe(5)

    fse.writeJson.mockClear()
    await writeHarnessConfig({ backlogPlatform: 'github', repoPlatform: 'github', sourceMode: 'current', sourceRoots: [], maxConcurrentAgents: 0, cwd: tmpDir })
    expect(lastPayload().agents.maxConcurrent).toBe(1)
  })

  it('preserves existing models and maxConcurrent when not provided (merge)', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: '1', stderr: '' })
    fse.readJson.mockResolvedValueOnce({
      models: { plan: 'p', build: 'b', fast: 'f' },
      agents: { maxConcurrent: 5 },
    })

    await writeHarnessConfig({ backlogPlatform: 'github', repoPlatform: 'github', sourceMode: 'current', sourceRoots: [], cwd: tmpDir })

    const payload = lastPayload()
    expect(payload.models).toEqual({ plan: 'p', build: 'b', fast: 'f' })
    expect(payload.agents.maxConcurrent).toBe(5)
  })

  it('new selections override preserved config', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: '1', stderr: '' })
    fse.readJson.mockResolvedValueOnce({
      models: { build: 'old' },
      agents: { maxConcurrent: 2 },
    })

    await writeHarnessConfig({
      backlogPlatform: 'github',
      repoPlatform: 'github',
      sourceMode: 'current',
      sourceRoots: [],
      buildModel: 'new',
      maxConcurrentAgents: 4,
      cwd: tmpDir,
    })

    const payload = lastPayload()
    expect(payload.models.build).toBe('new')
    expect(payload.agents.maxConcurrent).toBe(4)
  })

  it('migrates the legacy caveman selection to Simple English', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: '1', stderr: '' })
    fse.readJson.mockResolvedValueOnce({ tools: { caveman: true } })

    await writeHarnessConfig({ backlogPlatform: 'github', repoPlatform: 'github', sourceMode: 'current', sourceRoots: [], cwd: tmpDir })

    const payload = lastPayload()
    expect(payload.tools.simpleEnglish).toBe(true)
    expect(payload.tools.caveman).toBeUndefined()
  })

  it('preserves unknown project metadata during refresh', async () => {
    execa.mockResolvedValue({ exitCode: 0, stdout: '1', stderr: '' })
    fse.readJson.mockResolvedValueOnce({
      project: { owner: 'team-a' },
      models: { build: 'old' },
      tools: { customTool: true },
    })

    await writeHarnessConfig({
      backlogPlatform: 'github',
      repoPlatform: 'github',
      sourceMode: 'current',
      sourceRoots: [],
      buildModel: 'new',
      cwd: tmpDir,
    })

    const payload = lastPayload()
    expect(payload.project).toEqual({ owner: 'team-a' })
    expect(payload.tools.customTool).toBe(true)
    expect(payload.models.build).toBe('new')
  })
})
