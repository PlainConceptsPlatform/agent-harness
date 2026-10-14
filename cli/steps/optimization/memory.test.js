import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { parse as parseJsonc } from 'jsonc-parser'

vi.mock('execa', () => ({ execa: vi.fn() }))
vi.mock('./skills-lock.js', () => ({ addSkillToLock: vi.fn() }))
vi.mock('../../utils/exec.js')

import { execa } from 'execa'
import { installMemory } from './memory.js'

describe('installMemory()', () => {
  let tmpDir
  let configPath

  beforeEach(() => {
    vi.clearAllMocks()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-test-'))
    configPath = path.join(tmpDir, 'opencode.jsonc')
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
    vi.mocked(execa).mockResolvedValue({ exitCode: 0 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates the MCP entry only under mcp.servers.agentmemory', async () => {
    expect(await installMemory({ skipHeader: true })).toEqual({ optedIn: true, installed: true })

    const config = parseJsonc(fs.readFileSync(configPath, 'utf-8'))
    expect(config.mcp.servers.agentmemory).toEqual({
      type: 'local',
      command: ['npx', '-y', '@agentmemory/mcp'],
      environment: { AGENTMEMORY_URL: 'http://localhost:3111' },
      disabled: false,
      timeout: { catalog: 120000, execution: 120000 },
    })
    expect(config.mcp.agentmemory).toBeUndefined()
  })

  it('preserves an existing v2 entry and other configuration including comments', async () => {
    const text = `{
  // Keep existing configuration
  "mcp": {
    "servers": {
      "agentmemory": {"type": "local", "command": ["custom-memory"], "disabled": true},
      "codegraph": {"type": "local", "command": ["custom-codegraph"]}
    }
  }
}`
    fs.writeFileSync(configPath, text)

    await installMemory({ skipHeader: true })

    expect(fs.readFileSync(configPath, 'utf-8')).toBe(text)
  })

  it('does not use a legacy flat entry to skip configuring the v2 entry', async () => {
    const legacy = { type: 'local', command: ['legacy-memory'] }
    fs.writeFileSync(configPath, JSON.stringify({ mcp: { agentmemory: legacy } }))

    await installMemory({ skipHeader: true })

    const config = parseJsonc(fs.readFileSync(configPath, 'utf-8'))
    expect(config.mcp.servers.agentmemory.command).toEqual(['npx', '-y', '@agentmemory/mcp'])
    expect(config.mcp.agentmemory).toEqual(legacy)
  })
})
