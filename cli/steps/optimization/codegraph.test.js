import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import fse from 'fs-extra'

vi.mock('execa', () => ({ execa: vi.fn() }))
vi.mock('../../utils/exec.js')

import { execa } from 'execa'
import { error, warn } from '../../utils/exec.js'
import { fixCodegraphConfig, installCodegraph } from './codegraph.js'

describe('fixCodegraphConfig()', () => {
  let tmpDir

  beforeEach(() => {
    vi.clearAllMocks()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-test-'))
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns true when opencode.jsonc does not exist', async () => {
    expect(await fixCodegraphConfig()).toBe(true)
  })

  it('normalizes only the OpenCode 2 CodeGraph entry', async () => {
    fs.writeFileSync(path.join(tmpDir, 'opencode.jsonc'), JSON.stringify({
      $schema: 'https://opencode.ai/config.json',
      plugin: ['existing-plugin'],
      mcp: {
        timeout: { startup: 45000 },
        servers: {
          codegraph: { command: ['codegraph', 'serve', '--mcp'] },
          agentmemory: { type: 'local', command: ['custom-memory'] },
        },
      },
    }))

    expect(await fixCodegraphConfig()).toBe(true)

    const result = await fse.readJson(path.join(tmpDir, 'opencode.jsonc'))
    expect(result.mcp.servers.codegraph).toEqual({
      type: 'local',
      command: ['npx', '--yes', '@colbymchenry/codegraph', 'serve', '--mcp'],
      timeout: { catalog: 120000, execution: 120000 },
      codemode: false,
    })
    expect(result.plugin).toEqual(['existing-plugin'])
    expect(result.mcp.timeout).toEqual({ startup: 45000 })
    expect(result.mcp.servers.agentmemory).toEqual({ type: 'local', command: ['custom-memory'] })
    expect(result.mcp.servers.timeout).toBeUndefined()
  })

  it('handles JSONC comments and preserves them', async () => {
    fs.writeFileSync(path.join(tmpDir, 'opencode.jsonc'), `{
  // Keep this project setting
  "default_agent": "build",
  "mcp": {
    "servers": {
      "codegraph": { "command": ["codegraph", "serve", "--mcp"] }
    }
  }
}
`)

    expect(await fixCodegraphConfig()).toBe(true)

    const content = fs.readFileSync(path.join(tmpDir, 'opencode.jsonc'), 'utf-8')
    expect(content).toContain('Keep this project setting')
    expect(content).toContain('"default_agent": "build"')
    expect(content).toContain('"codegraph"')
  })

  it('normalizes the installer numeric timeout to the OpenCode 2 timeout shape', async () => {
    fs.writeFileSync(path.join(tmpDir, 'opencode.jsonc'), JSON.stringify({
      mcp: {
        servers: {
          codegraph: { command: ['codegraph', 'serve', '--mcp'], timeout: 300000 },
        },
      },
    }))

    await fixCodegraphConfig()

    const result = await fse.readJson(path.join(tmpDir, 'opencode.jsonc'))
    expect(result.mcp.servers.codegraph.timeout).toEqual({
      catalog: 300000,
      execution: 300000,
    })
  })

  it('preserves an explicit OpenCode 2 timeout object', async () => {
    fs.writeFileSync(path.join(tmpDir, 'opencode.jsonc'), JSON.stringify({
      mcp: {
        servers: {
          codegraph: {
            type: 'local',
            command: ['npx', '--yes', '@colbymchenry/codegraph', 'serve', '--mcp'],
            timeout: { catalog: 300000 },
            codemode: false,
          },
        },
      },
    }))

    await fixCodegraphConfig()

    const result = await fse.readJson(path.join(tmpDir, 'opencode.jsonc'))
    expect(result.mcp.servers.codegraph.timeout).toEqual({ catalog: 300000 })
  })

  it('preserves the OpenCode 2 server layout and disabled setting', async () => {
    fs.writeFileSync(path.join(tmpDir, 'opencode.jsonc'), JSON.stringify({
      mcp: {
        servers: {
          codegraph: {
            type: 'local',
            command: ['codegraph', 'serve', '--mcp'],
            disabled: true,
            codemode: false,
          },
        },
      },
    }))

    expect(await fixCodegraphConfig()).toBe(true)

    const result = await fse.readJson(path.join(tmpDir, 'opencode.jsonc'))
    expect(result.mcp.servers.codegraph).toEqual({
      type: 'local',
      command: ['npx', '--yes', '@colbymchenry/codegraph', 'serve', '--mcp'],
      timeout: { catalog: 120000, execution: 120000 },
      disabled: true,
      codemode: false,
    })
  })

  it('normalizes the global OpenCode config when global scope is selected', async () => {
    const configDir = path.join(tmpDir, '.config', 'opencode')
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(path.join(configDir, 'opencode.jsonc'), JSON.stringify({
      mcp: {
        servers: {
          codegraph: { type: 'local', command: ['codegraph', 'serve', '--mcp'] },
        },
      },
    }))
    vi.stubEnv('XDG_CONFIG_HOME', path.join(tmpDir, '.config'))

    expect(await fixCodegraphConfig('global')).toBe(true)

    const result = await fse.readJson(path.join(configDir, 'opencode.jsonc'))
    expect(result.mcp.servers.codegraph.command[0]).toBe('npx')
  })

  it('leaves legacy config layouts untouched', async () => {
    const text = JSON.stringify({
      mcpServers: { codegraph: { command: ['codegraph', 'serve', '--mcp'] } },
      mcp: { codegraph: { command: ['codegraph', 'serve', '--mcp'], enabled: true } },
    })
    fs.writeFileSync(path.join(tmpDir, 'opencode.jsonc'), text)

    await fixCodegraphConfig()

    expect(fs.readFileSync(path.join(tmpDir, 'opencode.jsonc'), 'utf-8')).toBe(text)
  })

  it('leaves an unparseable config untouched', async () => {
    const configPath = path.join(tmpDir, 'opencode.jsonc')
    fs.writeFileSync(configPath, 'not valid json {{{')

    expect(await fixCodegraphConfig()).toBe(false)
    expect(fs.readFileSync(configPath, 'utf-8')).toBe('not valid json {{{')
    expect(warn).toHaveBeenCalledWith('Could not parse opencode.jsonc, leaving it untouched')
  })

  it('configures OpenCode and initializes the index without globally installing the CLI', async () => {
    vi.mocked(execa).mockResolvedValue({ exitCode: 0 })

    const result = await installCodegraph({ skipHeader: true, installScope: 'local' })

    expect(result).toEqual({ optedIn: true, installed: true })
    expect(execa).toHaveBeenNthCalledWith(
      1,
      'npx',
      ['--yes', '@colbymchenry/codegraph', 'install', '--target=opencode', '--location=local', '--yes'],
      expect.objectContaining({ cwd: tmpDir, reject: false, stdio: 'pipe' }),
    )
    expect(execa).toHaveBeenNthCalledWith(
      2,
      'npx',
      ['@colbymchenry/codegraph', 'init', '-i'],
      expect.objectContaining({ cwd: tmpDir, reject: false, stdio: 'pipe' }),
    )
    expect(vi.mocked(execa).mock.calls.every(([command]) => command === 'npx')).toBe(true)
  })

  it('stops when the CodeGraph agent installation fails', async () => {
    vi.mocked(execa).mockResolvedValue({ exitCode: 1, stderr: 'permission denied' })

    const result = await installCodegraph({ skipHeader: true })

    expect(result).toEqual({ optedIn: true, installed: false })
    expect(execa).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
  })
})
