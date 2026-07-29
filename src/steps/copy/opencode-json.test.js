import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

vi.mock('../../utils/exec.js', () => ({
  success: vi.fn(),
}))

import { patchOpencodeJson } from './opencode-json.js'

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
  it('creates the file with agent block when missing', async () => {
    await patchOpencodeJson()

    const config = readConfig()
    expect(config.agent.build.disable).toBe(true)
    expect(config.agent.plan.disable).toBe(true)
    expect(config.$schema).toBe('https://opencode.ai/config.json')
    expect(config.permission.question).toBe('allow')
    expect(config.permission.todowrite).toBe('allow')
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
    expect(config.agent.build.disable).toBe(true)
    expect(config.agent.plan.disable).toBe(true)
    expect(config.model).toBe('anthropic/claude-sonnet-4-5')
    expect(config.plugin).toEqual(['some-plugin'])
    expect(config.skills.paths).toEqual(['.agents/skills'])
  })

  it('does not write when agents are disabled and skill permissions are present', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'opencode.jsonc'),
      JSON.stringify({
        $schema: 'https://opencode.ai/config.json',
        agent: { build: { disable: true }, plan: { disable: true } },
        permission: {
          question: 'allow',
          todowrite: 'allow',
          skill: { 'ob-*': 'allow', 'openspec-*': 'allow' },
        },
        skills: { paths: ['.agents/skills'] },
      }, null, 2),
    )

    const result = await patchOpencodeJson()
    expect(result.patched).toBe(false)
  })

  it('adds skill permissions when only they are missing', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'opencode.jsonc'),
      JSON.stringify({
        $schema: 'https://opencode.ai/config.json',
        agent: { build: { disable: true }, plan: { disable: true } },
        permission: { skill: { 'internal-*': 'deny' } },
      }, null, 2),
    )

    const result = await patchOpencodeJson()
    expect(result.patched).toBe(true)

    const config = readConfig()
    expect(config.permission.skill['ob-*']).toBe('allow')
    expect(config.permission.skill['openspec-*']).toBe('allow')
    expect(config.permission.skill['internal-*']).toBe('deny')
  })

  it('creates skill permissions when the file is missing', async () => {
    await patchOpencodeJson()

    const config = readConfig()
    expect(config.permission.skill['ob-*']).toBe('allow')
    expect(config.permission.skill['openspec-*']).toBe('allow')
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
    expect(content).toContain('"disable": true')
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
        agent: { build: { disable: true }, plan: { disable: true } },
        permission: {
          question: 'allow',
          todowrite: 'allow',
          skill: { 'ob-*': 'allow', 'openspec-*': 'allow' },
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
        agent: { build: { disable: true }, plan: { disable: true } },
        permission: {
          question: 'allow',
          todowrite: 'allow',
          skill: { 'ob-*': 'allow', 'openspec-*': 'allow' },
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
