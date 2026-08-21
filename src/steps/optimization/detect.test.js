import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fse from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import { detectInstalledTools, reconcileTools } from './detect.js'

let cwd

const OPENCODE_JSONC = `{
  // a comment, because this file is jsonc
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "codegraph": { "type": "local", "enabled": true },
    "agentmemory": { "type": "local", "enabled": true }
  }
}
`

beforeEach(async () => {
  cwd = await fse.mkdtemp(path.join(os.tmpdir(), 'pc-detect-'))
})

afterEach(async () => {
  await fse.remove(cwd)
})

describe('detectInstalledTools()', () => {
  it('finds nothing in an empty project', () => {
    const found = detectInstalledTools(cwd)
    expect(found.codegraph).toBe(false)
    expect(found.memory).toBe(false)
    expect(found.humanizer).toBe(false)
  })

  // This is the Numa and Odissey shape: MCP servers running, flags saying false.
  it('finds codegraph and agentmemory from the mcp block', async () => {
    await fse.outputFile(path.join(cwd, 'opencode.jsonc'), OPENCODE_JSONC)

    const found = detectInstalledTools(cwd)
    expect(found.codegraph).toBe(true)
    expect(found.memory).toBe(true)
  })

  it('ignores an explicitly disabled mcp server', async () => {
    await fse.outputFile(
      path.join(cwd, 'opencode.jsonc'),
      '{ "mcp": { "codegraph": { "enabled": false } } }',
    )

    expect(detectInstalledTools(cwd).codegraph).toBe(false)
  })

  it('finds codegraph from its index even with no mcp entry', async () => {
    await fse.ensureDir(path.join(cwd, '.codegraph'))

    expect(detectInstalledTools(cwd).codegraph).toBe(true)
  })

  it('finds the skill-based tools', async () => {
    await fse.ensureDir(path.join(cwd, '.agents', 'skills', 'humanizer'))
    await fse.ensureDir(path.join(cwd, '.agents', 'skills', 'simple-english'))

    const found = detectInstalledTools(cwd)
    expect(found.humanizer).toBe(true)
    expect(found.simpleEnglish).toBe(true)
  })

  it('survives an unparseable config', async () => {
    await fse.outputFile(path.join(cwd, 'opencode.jsonc'), '{ not json')

    expect(() => detectInstalledTools(cwd)).not.toThrow()
    expect(detectInstalledTools(cwd).codegraph).toBe(false)
  })
})

describe('reconcileTools()', () => {
  it('turns on what it finds installed', async () => {
    await fse.outputFile(path.join(cwd, 'opencode.jsonc'), OPENCODE_JSONC)
    await fse.ensureDir(path.join(cwd, '.agents', 'skills', 'humanizer'))

    const merged = reconcileTools({ rtk: true, codegraph: false, memory: false }, cwd)

    expect(merged.codegraph).toBe(true)
    expect(merged.memory).toBe(true)
    expect(merged.humanizer).toBe(true)
    expect(merged.rtk).toBe(true)
  })

  // rtk is a global CLI, so nothing in the repo proves it. Detection must not
  // be able to switch a recorded tool back off.
  it('never turns a saved flag off', () => {
    const merged = reconcileTools({ rtk: true, codegraph: true, memory: true }, cwd)

    expect(merged.rtk).toBe(true)
    expect(merged.codegraph).toBe(true)
    expect(merged.memory).toBe(true)
  })

  it('honours the retired caveman key one last time', () => {
    expect(reconcileTools({ caveman: true }, cwd).simpleEnglish).toBe(true)
  })
})
