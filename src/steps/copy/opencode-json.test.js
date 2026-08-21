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

function readConfig() {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, 'opencode.jsonc'), 'utf-8'))
}

describe('patchOpencodeJson()', () => {
  // Repos onboarded by 2.0.x carry `disable: true` on both agents. Leaving it
  // would hide build and plan entirely, since disable wins over mode.
  it('clears the disable flag left by earlier versions', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'opencode.jsonc'),
      JSON.stringify({
        $schema: 'https://opencode.ai/config.json',
        default_agent: 'fullstack-engineer',
        agent: { build: { disable: true }, plan: { disable: true } },
      }, null, 2),
    )

    const result = await patchOpencodeJson()
    expect(result.patched).toBe(true)

    const config = readConfig()
    expect(config.agent.build.disable).toBeUndefined()
    expect(config.agent.plan.disable).toBeUndefined()
    expect(config.agent.build.mode).toBe('primary')
    expect(config.agent.plan.mode).toBe('primary')
    expect(config.agent.plan.permission.edit).toBe('deny')
  })

  it('creates the file with agent block when missing', async () => {
    await patchOpencodeJson()

    const config = readConfig()
    expect(config.agent.build.mode).toBe('primary')
    expect(config.agent.plan.mode).toBe('primary')
    expect(config.agent.plan.permission.edit).toBe('deny')
    expect(config.agent.build.disable).toBeUndefined()
    expect(config.agent.plan.disable).toBeUndefined()
    expect(config.$schema).toBe('https://opencode.ai/config.json')
    expect(config.permission.question).toBe('allow')
    expect(config.permission.todowrite).toBe('allow')
    expect(config.permission.skill).toBe('allow')
    expect(config.skills.paths).toEqual(['.agents/skills'])
  })

  it('adds agent block to existing config without touching other keys', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'opencode.jsonc'),
      JSON.stringify({
        $schema: 'https://opencode.ai/config.json',
        model: 'anthropic/claude-sonnet-4-5',
        plugin: ['some-plugin'],
      }, null, 2),
    )

    await patchOpencodeJson()

    const config = readConfig()
    expect(config.agent.build.mode).toBe('primary')
    expect(config.agent.plan.mode).toBe('primary')
    expect(config.agent.plan.permission.edit).toBe('deny')
    expect(config.agent.build.disable).toBeUndefined()
    expect(config.agent.plan.disable).toBeUndefined()
    expect(config.model).toBe('anthropic/claude-sonnet-4-5')
    expect(config.plugin).toEqual(['some-plugin'])
    expect(config.skills.paths).toEqual(['.agents/skills'])
  })

  it('does not write when build/plan are already overridden and skill loading is allowed', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'opencode.jsonc'),
      JSON.stringify({
        $schema: 'https://opencode.ai/config.json',
        agent: {
          build: { mode: 'primary' },
          plan: { mode: 'primary', permission: { edit: 'deny' } },
        },
        permission: {
          question: 'allow',
          todowrite: 'allow',
          skill: 'allow',
        },
        skills: { paths: ['.agents/skills'] },
        compaction: { auto: true, prune: true },
      }, null, 2),
    )

    const result = await patchOpencodeJson()
    expect(result.patched).toBe(false)
  })

  it('allows all skills when only skill permission is missing', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'opencode.jsonc'),
      JSON.stringify({
        $schema: 'https://opencode.ai/config.json',
        agent: {
          build: { mode: 'primary' },
          plan: { mode: 'primary', permission: { edit: 'deny' } },
        },
        permission: { skill: { 'internal-*': 'deny' } },
      }, null, 2),
    )

    const result = await patchOpencodeJson()
    expect(result.patched).toBe(true)

    const config = readConfig()
    expect(config.permission.skill).toBe('allow')
  })

  it('creates skill permissions when the file is missing', async () => {
    await patchOpencodeJson()

    const config = readConfig()
    expect(config.permission.skill).toBe('allow')
    expect(config.permission.question).toBe('allow')
    expect(config.permission.todowrite).toBe('allow')
    expect(config.skills.paths).toEqual(['.agents/skills'])
  })

  it('preserves comments in JSONC files', async () => {
    const jsonc = `{
  // This is a comment
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5"
}
`
    fs.writeFileSync(path.join(tmpDir, 'opencode.jsonc'), jsonc)

    await patchOpencodeJson()

    const content = fs.readFileSync(path.join(tmpDir, 'opencode.jsonc'), 'utf-8')
    expect(content).toContain('This is a comment')
    expect(content).toContain('"mode": "primary"')
  })

  it('returns patched:false on parse error', async () => {
    fs.writeFileSync(path.join(tmpDir, 'opencode.jsonc'), '{ invalid json }')

    const result = await patchOpencodeJson()
    expect(result.patched).toBe(false)
    expect(result.reason).toBe('parse error')
  })

  it('adds .agents/skills to skills.paths when missing', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'opencode.jsonc'),
      JSON.stringify({
        $schema: 'https://opencode.ai/config.json',
        agent: {
          build: { mode: 'primary' },
          plan: { mode: 'primary', permission: { edit: 'deny' } },
        },
        permission: {
          question: 'allow',
          todowrite: 'allow',
          skill: 'allow',
        },
      }, null, 2),
    )

    const result = await patchOpencodeJson()
    expect(result.patched).toBe(true)

    const config = readConfig()
    expect(config.skills.paths).toEqual(['.agents/skills'])
  })

  it('appends .agents/skills to existing skills.paths without removing other paths', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'opencode.jsonc'),
      JSON.stringify({
        $schema: 'https://opencode.ai/config.json',
        agent: {
          build: { mode: 'primary' },
          plan: { mode: 'primary', permission: { edit: 'deny' } },
        },
        permission: {
          question: 'allow',
          todowrite: 'allow',
          skill: 'allow',
        },
        skills: { paths: ['/custom/skills'] },
      }, null, 2),
    )

    const result = await patchOpencodeJson()
    expect(result.patched).toBe(true)

    const config = readConfig()
    expect(config.skills.paths).toEqual(['/custom/skills', '.agents/skills'])
  })
})

describe('patchOpencodePackage()', () => {
  it('updates only the shipped OpenCode plugin dependencies', async () => {
    const packagePath = path.join(tmpDir, '.opencode', 'package.json')
    fs.mkdirSync(path.dirname(packagePath), { recursive: true })
    fs.writeFileSync(packagePath, JSON.stringify({
      dependencies: {
        '@opencode-ai/plugin': '1.17.13',
        '@opentui/core': '0.3.4',
        '@opentui/solid': '0.3.4',
        'solid-js': '1.9.10',
        custom: '1.0.0',
      },
    }))

    await patchOpencodePackage()

    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
    expect(packageJson.dependencies).toEqual({
      '@opencode-ai/plugin': '1.18.19',
      '@opentui/core': '0.5.6',
      '@opentui/solid': '0.5.6',
      'solid-js': '1.9.12',
      custom: '1.0.0',
    })
  })
})
