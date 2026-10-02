import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

vi.mock('../../utils/exec.js', () => ({
  success: vi.fn(),
}))

import { patchOpencodeJson, patchOpencodePackage } from './opencode-json.js'

let tmpDir

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-json-test-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function writeConfig(config) {
  fs.writeFileSync(path.join(tmpDir, 'opencode.jsonc'), JSON.stringify(config, null, 2))
}

function readConfig() {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, 'opencode.jsonc'), 'utf-8'))
}

const NATIVE_PLAN_PERMISSIONS = [
  { action: 'edit', resource: '*', effect: 'deny' },
  { action: 'subagent', resource: '*', effect: 'deny' },
]

describe('patchOpencodeJson()', () => {
  it('creates the file with the native V2 agent block when missing', async () => {
    const result = await patchOpencodeJson()
    expect(result.patched).toBe(true)

    const config = readConfig()
    expect(config.$schema).toBe('https://opencode.ai/config.json')
    expect(config.default_agent).toBe('plan')
    expect(config.agents.build.mode).toBe('primary')
    expect(config.agents.plan.mode).toBe('primary')
    expect(config.agents.plan.permissions).toEqual(NATIVE_PLAN_PERMISSIONS)
    expect(config.skills).toEqual(['.agents/skills'])
  })

  it('migrates a V1 agent block: disable, mode and permission map', async () => {
    writeConfig({
      $schema: 'https://opencode.ai/config.json',
      default_agent: 'fullstack-engineer',
      agent: {
        build: { disable: true },
        plan: { disable: true, permission: { edit: 'deny', task: 'deny' } },
      },
    })

    await patchOpencodeJson()

    const config = readConfig()
    expect(config.agent).toBeUndefined()
    expect(config.agents.build.disabled).toBeUndefined()
    expect(config.agents.build.disable).toBeUndefined()
    expect(config.agents.build.mode).toBe('primary')
    expect(config.agents.plan.permissions).toEqual(NATIVE_PLAN_PERMISSIONS)
    expect(config.default_agent).toBe('plan')
  })

  it('leaves a deliberate choice of build alone', async () => {
    writeConfig({ default_agent: 'build' })
    await patchOpencodeJson()
    expect(readConfig().default_agent).toBe('build')
  })

  it('moves a V1 permission map into permission rules and drops todowrite', async () => {
    writeConfig({
      permission: { question: 'allow', todowrite: 'allow', skill: 'allow' },
    })

    await patchOpencodeJson()

    const config = readConfig()
    expect(config.permission).toBeUndefined()
    expect(config.permissions).toEqual(
      expect.arrayContaining([
        { action: 'question', resource: '*', effect: 'allow' },
        { action: 'skill', resource: '*', effect: 'allow' },
      ]),
    )
    expect(config.permissions.find(rule => rule.action === 'todowrite')).toBeUndefined()
  })

  it('renames V1 action names inside agent permissions', async () => {
    writeConfig({ agent: { reviewer: { permission: { bash: 'deny', task: 'ask' } } } })

    await patchOpencodeJson()

    expect(readConfig().agents.reviewer.permissions).toEqual([
      { action: 'shell', resource: '*', effect: 'deny' },
      { action: 'subagent', resource: '*', effect: 'ask' },
    ])
  })

  it('converts skills.paths into the V2 skills array, preserving other paths', async () => {
    writeConfig({ skills: { paths: ['/custom/skills'] } })

    await patchOpencodeJson()

    expect(readConfig().skills).toEqual(['/custom/skills', '.agents/skills'])
  })

  it('drops compaction.prune and moves reserved to buffer', async () => {
    writeConfig({ compaction: { auto: true, prune: true, reserved: 12000 } })

    await patchOpencodeJson()

    const config = readConfig()
    expect(config.compaction.prune).toBeUndefined()
    expect(config.compaction.reserved).toBeUndefined()
    expect(config.compaction.auto).toBe(true)
    expect(config.compaction.buffer).toBe(12000)
  })

  it('moves V1 plugins to plugins, dropping the plugin API and the native-replaced notifier', async () => {
    writeConfig({
      plugin: [
        '@opencode-ai/plugin@1.17.13',
        '@mohak34/opencode-notifier@0.2.8',
        '@different-ai/opencode-browser@4.6.1',
        '@slkiser/opencode-quota@4.2.0',
        'some-other-plugin',
      ],
    })

    await patchOpencodeJson()

    const config = readConfig()
    expect(config.plugin).toBeUndefined()
    expect(config.plugins).toEqual(['@slkiser/opencode-quota@5.0.1', 'some-other-plugin'])
  })

  it('moves MCP servers under mcp.servers and inverts enabled', async () => {
    writeConfig({
      mcp: {
        playwright: { type: 'local', command: ['npx', '@playwright/mcp'], enabled: true, timeout: 120000 },
      },
    })

    await patchOpencodeJson()

    const config = readConfig()
    expect(config.mcp.servers.playwright).toEqual({
      type: 'local',
      command: ['npx', '@playwright/mcp'],
      disabled: false,
      timeout: { catalog: 120000, execution: 120000 },
    })
    expect(config.mcp.timeout).toEqual({ catalog: 120000, execution: 120000 })
  })

  it('strips V1-only experimental fields', async () => {
    writeConfig({ experimental: { openTelemetry: true, mcp_timeout: 300000, keep_me: 1 } })

    await patchOpencodeJson()

    expect(readConfig().experimental).toEqual({ keep_me: 1 })
  })

  it('is a no-op on a config that is already native V2', async () => {
    writeConfig({
      $schema: 'https://opencode.ai/config.json',
      default_agent: 'plan',
      agents: {
        build: { mode: 'primary' },
        plan: { mode: 'primary', permissions: NATIVE_PLAN_PERMISSIONS },
      },
      permissions: [
        { action: 'question', resource: '*', effect: 'allow' },
        { action: 'skill', resource: '*', effect: 'allow' },
      ],
      skills: ['.agents/skills'],
      compaction: { auto: true, buffer: 10000 },
      mcp: {
        servers: { 'agent-browser': { type: 'local', command: ['agent-browser', 'mcp', '--tools', 'core'], disabled: false } },
        timeout: { catalog: 300000, execution: 300000 },
      },
    })

    const result = await patchOpencodeJson()
    expect(result.patched).toBe(false)
  })

  it('preserves keys it does not know about', async () => {
    writeConfig({ model: 'plainconcepts/quasar-438b', custom_key: { keep: true } })

    await patchOpencodeJson()

    const config = readConfig()
    expect(config.model).toBe('plainconcepts/quasar-438b')
    expect(config.custom_key).toEqual({ keep: true })
  })

  it('returns patched:false on parse error', async () => {
    fs.writeFileSync(path.join(tmpDir, 'opencode.jsonc'), '{ invalid json }')

    const result = await patchOpencodeJson()
    expect(result.patched).toBe(false)
    expect(result.reason).toBe('parse error')
  })
})

describe('patchOpencodePackage()', () => {
  it('pins the V2 plugin API and removes the V1 packages', async () => {
    const packagePath = path.join(tmpDir, '.opencode', 'package.json')
    fs.mkdirSync(path.dirname(packagePath), { recursive: true })
    fs.writeFileSync(packagePath, JSON.stringify({
      dependencies: {
        '@opencode-ai/plugin': '1.17.13',
        '@opentui/core': '0.3.4',
        '@opentui/solid': '0.3.4',
        'solid-js': '1.9.10',
        '@mohak34/opencode-notifier': '0.2.8',
        custom: '1.0.0',
      },
    }))

    await patchOpencodePackage()

    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
    expect(packageJson.dependencies).toEqual({
      '@opencode/plugin': '2.0.22',
      custom: '1.0.0',
    })
  })
})
