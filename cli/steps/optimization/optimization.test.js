import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inquirer/prompts', () => ({
  checkbox: vi.fn(),
  confirm: vi.fn(),
}))

vi.mock('../../utils/exec.js', () => ({
  code: vi.fn(),
  commandExists: vi.fn(),
  header: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('./quota.js', () => ({ installQuota: vi.fn() }))
vi.mock('./simple-english.js', () => ({ installSimpleEnglish: vi.fn() }))
vi.mock('./codegraph.js', () => ({ installCodegraph: vi.fn() }))
vi.mock('./memory.js', () => ({ installMemory: vi.fn() }))
vi.mock('./humanizer.js', () => ({ installHumanizer: vi.fn() }))
vi.mock('./patch-guardrails.js', () => ({ patchGuardrails: vi.fn().mockResolvedValue({ patched: true, count: 0 }) }))
vi.mock('./skills-lock.js', () => ({ addSkillToLock: vi.fn().mockResolvedValue(true) }))

vi.mock('execa', () => ({
  execa: vi.fn().mockResolvedValue({ exitCode: 0, stderr: '' }),
}))

vi.mock('fs-extra', () => ({
  default: {
    readJson: vi.fn().mockResolvedValue({
      info: 'Token optimization info',
      message: 'Select tools',
      timeoutMs: 5000,
      choices: [
        { value: 'rtk', checked: false },
        { value: 'quota', checked: false },
        { value: 'simpleEnglish', checked: false },
        { value: 'codegraph', checked: false },
        { value: 'memory', checked: false },
      ],
    }),
    pathExists: vi.fn().mockResolvedValue(false),
    writeJson: vi.fn().mockResolvedValue(undefined),
  },
}))

import { checkbox } from '@inquirer/prompts'
import { commandExists, warn } from '../../utils/exec.js'
import { installQuota } from './quota.js'
import { installSimpleEnglish } from './simple-english.js'
import { installCodegraph } from './codegraph.js'
import { tokenOptimizationStep } from './index.js'

const checkboxMock = vi.mocked(checkbox)
const commandExistsMock = vi.mocked(commandExists)
const installQuotaMock = vi.mocked(installQuota)
const installSimpleEnglishMock = vi.mocked(installSimpleEnglish)
const installCodegraphMock = vi.mocked(installCodegraph)

describe('tokenOptimizationStep()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs all optimizations by default selection', async () => {
    const originalIsTTY = process.stdin.isTTY
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })

    checkboxMock.mockResolvedValue(['rtk', 'quota', 'simpleEnglish', 'codegraph'])
    commandExistsMock.mockResolvedValue(true)
    installQuotaMock.mockResolvedValue({ optedIn: true, installed: true })
    installSimpleEnglishMock.mockResolvedValue({ optedIn: true, installed: true })
    installCodegraphMock.mockResolvedValue({ optedIn: true, installed: true })

    const result = await tokenOptimizationStep()

    Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true })

    expect(commandExistsMock).toHaveBeenCalledWith('rtk')
    expect(installQuotaMock).toHaveBeenCalledWith({ skipHeader: true, skipPrompt: true })
    expect(installSimpleEnglishMock).toHaveBeenCalledWith(expect.objectContaining({ skipHeader: true, skipPrompt: true }))
    expect(installCodegraphMock).toHaveBeenCalledWith(expect.objectContaining({ skipHeader: true }))
    expect(result.rtk.available).toBe(true)
    expect(result.quota.installed).toBe(true)
    expect(result.simpleEnglish.installed).toBe(true)
    expect(result.codegraph.installed).toBe(true)
  })

  it('skips all tools when nothing is selected', async () => {
    checkboxMock.mockResolvedValue([])

    const result = await tokenOptimizationStep()

    expect(commandExistsMock).not.toHaveBeenCalled()
    expect(installQuotaMock).not.toHaveBeenCalled()
    expect(installSimpleEnglishMock).not.toHaveBeenCalled()
    expect(installCodegraphMock).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith('No token optimization tools selected')
    expect(result.rtk.optedIn).toBe(false)
    expect(result.quota.optedIn).toBe(false)
    expect(result.simpleEnglish.optedIn).toBe(false)
    expect(result.codegraph.optedIn).toBe(false)
  })
})
