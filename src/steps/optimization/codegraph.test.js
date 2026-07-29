import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import fse from 'fs-extra'

vi.mock('execa', () => ({ execa: vi.fn() }))
vi.mock('../../utils/exec.js')

import { warn } from '../../utils/exec.js'
import { fixCodegraphConfig } from './codegraph.js'

describe('fixCodegraphConfig()', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-test-'))
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('returns true when opencode.jsonc does not exist', async () => {
    expect(await fixCodegraphConfig()).toBe(true)
  })

  it('normalizes mcpServers in the project opencode.jsonc', async () => {
    fs.writeFileSync(path.join(tmpDir, 'opencode.jsonc'), JSON.stringify({
      $schema: 'https://opencode.ai/config.json',
      plugin: ['existing-plugin'],
      mcpServers: {
        codegraph: { command: ['codegraph', 'serve', '--mcp'] },
      },
    }))

    expect(await fixCodegraphConfig()).toBe(true)

    const result = await fse.readJson(path.join(tmpDir, 'opencode.jsonc'))
    expect(result.mcp.codegraph).toEqual({
      command: ['npx', '@colbymchenry/codegraph', 'serve', '--mcp'],
      timeout: 120000,
    })
    expect(result.plugin).toEqual(['existing-plugin'])
    expect(result.mcpServers).toBeUndefined()
  })

  it('handles JSONC comments and preserves them', async () => {
    fs.writeFileSync(path.join(tmpDir, 'opencode.jsonc'), `{
  // Keep this project setting
  "default_agent": "fullstack-engineer",
  "mcpServers": {
    "codegraph": { "command": ["codegraph", "serve", "--mcp"] }
  }
}
`)

    expect(await fixCodegraphConfig()).toBe(true)

    const content = fs.readFileSync(path.join(tmpDir, 'opencode.jsonc'), 'utf-8')
    expect(content).toContain('Keep this project setting')
    expect(content).toContain('"default_agent": "fullstack-engineer"')
    expect(content).toContain('"codegraph"')
  })

  it('preserves an explicit codegraph timeout', async () => {
    fs.writeFileSync(path.join(tmpDir, 'opencode.jsonc'), JSON.stringify({
      mcpServers: {
        codegraph: { command: ['codegraph', 'serve', '--mcp'], timeout: 300000 },
      },
    }))

    await fixCodegraphConfig()

    const result = await fse.readJson(path.join(tmpDir, 'opencode.jsonc'))
    expect(result.mcp.codegraph.timeout).toBe(300000)
  })

  it('does not change non-codegraph commands', async () => {
    fs.writeFileSync(path.join(tmpDir, 'opencode.jsonc'), JSON.stringify({
      mcpServers: { myMcp: { command: ['my-own-mcp', 'serve'] } },
    }))

    await fixCodegraphConfig()

    const result = await fse.readJson(path.join(tmpDir, 'opencode.jsonc'))
    expect(result.mcp.myMcp.command).toEqual(['my-own-mcp', 'serve'])
  })

  it('leaves an unparseable config untouched', async () => {
    const configPath = path.join(tmpDir, 'opencode.jsonc')
    fs.writeFileSync(configPath, 'not valid json {{{')

    expect(await fixCodegraphConfig()).toBe(false)
    expect(fs.readFileSync(configPath, 'utf-8')).toBe('not valid json {{{')
    expect(warn).toHaveBeenCalledWith('Could not parse opencode.jsonc, leaving it untouched')
  })
})
