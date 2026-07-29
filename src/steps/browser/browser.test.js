import { describe, it, expect, vi, beforeEach } from 'vitest'
import { installBrowser } from './index.js'

vi.mock('../../utils/exec.js', () => ({
  header: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('fs-extra', () => ({
  default: {
    readJson: vi.fn().mockResolvedValue({
       installer: { command: 'npx', args: ['@different-ai/opencode-browser@4.6.1', 'install'] },
      output: { showAfter: '===', hideAfter: '===' },
      locationChoices: { local: '2', global: '1' },
      autoAnswers: [
        { trigger: 'Install', response: 'y' },
        { trigger: 'Choose config location', response: '__LOCATION__' },
      ],
    }),
  },
}))

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

describe('installBrowser()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls installer command from preset', async () => {
    const { execa } = await import('execa')
    const mockChild = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      stdin: { write: vi.fn() },
      then: (cb) => cb({ exitCode: 0 }),
    }
    execa.mockReturnValue(mockChild)

    await installBrowser()

    expect(execa).toHaveBeenCalledWith('npx', expect.arrayContaining(['@different-ai/opencode-browser@4.6.1']), expect.any(Object))
  })

  it('logs success when exit code is 0', async () => {
    const { execa } = await import('execa')
    const mockChild = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      stdin: { write: vi.fn() },
      then: (cb) => cb({ exitCode: 0 }),
    }
    execa.mockReturnValue(mockChild)
    const { success } = await import('../../utils/exec.js')

    await installBrowser()

    expect(success).toHaveBeenCalledWith('opencode-browser installed')
  })

  it('logs warning when exit code is non-zero', async () => {
    const { execa } = await import('execa')
    const mockChild = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      stdin: { write: vi.fn() },
      then: (cb) => cb({ exitCode: 1 }),
    }
    execa.mockReturnValue(mockChild)
    const { warn } = await import('../../utils/exec.js')

    await installBrowser()

    expect(warn).toHaveBeenCalledWith('opencode-browser install exited with non-zero code')
  })

  it('resolves __LOCATION__ to local answer by default', async () => {
    const { execa } = await import('execa')
    let capturedTriggers = null
    const mockChild = {
      stdout: { on: vi.fn((_, cb) => { capturedTriggers = cb }) },
      stderr: { on: vi.fn() },
      stdin: { write: vi.fn() },
      then: (cb) => cb({ exitCode: 0 }),
    }
    execa.mockReturnValue(mockChild)

    await installBrowser()

    if (capturedTriggers) capturedTriggers(Buffer.from('Choose config location'))
    expect(mockChild.stdin.write).toHaveBeenCalledWith('2\n')
  })

  it('resolves __LOCATION__ to global answer when installScope is global', async () => {
    const { execa } = await import('execa')
    let capturedTriggers = null
    const mockChild = {
      stdout: { on: vi.fn((_, cb) => { capturedTriggers = cb }) },
      stderr: { on: vi.fn() },
      stdin: { write: vi.fn() },
      then: (cb) => cb({ exitCode: 0 }),
    }
    execa.mockReturnValue(mockChild)

    await installBrowser({ installScope: 'global' })

    if (capturedTriggers) capturedTriggers(Buffer.from('Choose config location'))
    expect(mockChild.stdin.write).toHaveBeenCalledWith('1\n')
  })
})
