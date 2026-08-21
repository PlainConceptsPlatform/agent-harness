import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

vi.mock('../../utils/exec.js', () => ({
  success: vi.fn(),
  info: vi.fn(),
}))

import { generateFullstackEngineer, removeLegacyStartupDirectives } from './fullstack-engineer.js'

describe('generateFullstackEngineer()', () => {
  let tmpDir

  beforeEach(() => {
    vi.clearAllMocks()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fullstack-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('generates bare-bones fullstack-engineer.md with only guardrails by default', async () => {
    const res = await generateFullstackEngineer({ cwd: tmpDir })
    expect(res.generated).toBe(true)

    const content = fs.readFileSync(path.join(tmpDir, '.opencode', 'agents', 'fullstack-engineer.md'), 'utf-8')
    expect(content).toContain('mode: primary')
    expect(content).toContain('color: warning')
    expect(content).toContain('  question: allow')
    expect(content).toContain('  todowrite: allow')
    expect(content).not.toContain('**Startup — before doing anything else:**')
    expect(content).toContain('- Guardrails: @pc-guardrails-generic, @pc-guardrails-project')
    expect(content).toContain('You are the default engineer')
    expect(content).not.toContain('@react19')
    expect(content).not.toContain('@dotnet')
    expect(content).not.toContain('@browser-automation')
  })

  it('strips a stale model: line when regenerating (models belong in variants only)', async () => {
    const agentsDir = path.join(tmpDir, '.opencode', 'agents')
    fs.mkdirSync(agentsDir, { recursive: true })
    fs.writeFileSync(
      path.join(agentsDir, 'fullstack-engineer.md'),
      '---\ndescription: Old.\nmode: primary\nmodel: custom/model\n---\n\nYou are the default engineer.\n\n## Abilities\n- Guardrails: @pc-guardrails-generic, @pc-guardrails-project\n',
      'utf-8'
    )

    await generateFullstackEngineer({ cwd: tmpDir })

    const content = fs.readFileSync(path.join(agentsDir, 'fullstack-engineer.md'), 'utf-8')
    expect(content).not.toContain('model:')
    expect(content).not.toContain('custom/model')
  })

  it('preserves existing identity paragraph when regenerating', async () => {
    const agentsDir = path.join(tmpDir, '.opencode', 'agents')
    fs.mkdirSync(agentsDir, { recursive: true })
    fs.writeFileSync(
      path.join(agentsDir, 'fullstack-engineer.md'),
      '---\ndescription: Old.\nmode: primary\n---\n\nYou are a custom identity paragraph.\n\n## Abilities\n- Guardrails: @pc-guardrails-generic\n',
      'utf-8'
    )

    await generateFullstackEngineer({ cwd: tmpDir })

    const content = fs.readFileSync(path.join(agentsDir, 'fullstack-engineer.md'), 'utf-8')
    expect(content).toContain('You are a custom identity paragraph.')
    expect(content).not.toContain('You are the default engineer')
  })

  it('removes the old startup directive during migration', async () => {
    const agentsDir = path.join(tmpDir, '.opencode', 'agents')
    fs.mkdirSync(agentsDir, { recursive: true })
    fs.writeFileSync(
      path.join(agentsDir, 'fullstack-engineer.md'),
      '---\ndescription: Old.\nmode: primary\n---\n\nYou are a custom identity paragraph.\n\n**Startup — before doing anything else:** load every skill listed under `## Abilities`.\n\n## Abilities\n- Guardrails: @pc-guardrails-generic\n',
      'utf-8'
    )

    await removeLegacyStartupDirectives({ cwd: tmpDir })

    const content = fs.readFileSync(path.join(agentsDir, 'fullstack-engineer.md'), 'utf-8')
    expect(content).not.toContain('**Startup — before doing anything else:**')
    expect(content).toContain('You are a custom identity paragraph.')
  })

  it('removes the old startup directive from CRLF agent files', async () => {
    const agentsDir = path.join(tmpDir, '.opencode', 'agents')
    fs.mkdirSync(agentsDir, { recursive: true })
    fs.writeFileSync(
      path.join(agentsDir, 'frontend-engineer.md'),
      '---\r\ndescription: Frontend.\r\n---\r\n\r\nYou are a frontend engineer.\r\n\r\n**Startup, before doing anything else:** load every skill listed under `## Abilities`.\r\n\r\n## Abilities\r\n- Guardrails: @pc-guardrails-generic\r\n',
    )

    await removeLegacyStartupDirectives({ cwd: tmpDir })

    const content = fs.readFileSync(path.join(agentsDir, 'frontend-engineer.md'), 'utf-8')
    expect(content).not.toContain('**Startup')
  })

  it('preserves existing abilities when regenerating (e.g. skills added by /create-engineer)', async () => {
    const agentsDir = path.join(tmpDir, '.opencode', 'agents')
    fs.mkdirSync(agentsDir, { recursive: true })
    const existing = [
      '---',
      'description: Old.',
      'mode: primary',
      'model: custom/model',
      '---',
      '',
      'You are the default engineer.',
      '',
      '## Abilities',
      '- Guardrails: @pc-guardrails-generic, @pc-guardrails-project',
      '- Development: @react19-concurrent-patterns, @dotnet-best-practices',
      '- Testing: @react19-test-patterns',
      '',
    ].join('\n')
    fs.writeFileSync(path.join(agentsDir, 'fullstack-engineer.md'), existing, 'utf-8')

    await generateFullstackEngineer({ cwd: tmpDir })

    const content = fs.readFileSync(path.join(agentsDir, 'fullstack-engineer.md'), 'utf-8')
    expect(content).toContain('@react19-concurrent-patterns')
    expect(content).toContain('@dotnet-best-practices')
    expect(content).toContain('@react19-test-patterns')
    expect(content).not.toContain('model:')
    expect(content).not.toContain('custom/model')
  })
})
