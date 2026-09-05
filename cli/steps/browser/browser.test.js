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
      installer: { command: 'npm', args: ['install', '-g', 'agent-browser@0.36.0'] },
      chromeSetup: { command: 'agent-browser', args: ['install'] },
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

  it('runs the npm install and chrome setup from preset', async () => {
    const { execa } = await import('execa')
    execa.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })

    await installBrowser()

    expect(execa).toHaveBeenNthCalledWith(1, 'npm', ['install', '-g', 'agent-browser@0.36.0'], expect.any(Object))
    expect(execa).toHaveBeenNthCalledWith(2, 'agent-browser', ['install'], expect.any(Object))
  })

  it('logs success when both steps exit 0', async () => {
    const { execa } = await import('execa')
    execa.mockResolvedValue({ exitCode: 0, stdout: 'Chrome ready', stderr: '' })
    const { success } = await import('../../utils/exec.js')

    await installBrowser()

    expect(success).toHaveBeenCalledWith('agent-browser installed')
    expect(success).toHaveBeenCalledWith('agent-browser Chrome ready')
  })

  it('warns and skips chrome setup when npm install fails', async () => {
    const { execa } = await import('execa')
    execa.mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'engine incompat' })
    const { warn, success, info } = await import('../../utils/exec.js')

    await installBrowser()

    expect(warn).toHaveBeenCalledWith('agent-browser npm install exited with non-zero code')
    expect(info).toHaveBeenCalledWith('engine incompat')
    expect(success).not.toHaveBeenCalledWith('agent-browser installed')
    expect(execa).toHaveBeenCalledTimes(1)
  })

  it('warns when chrome setup exits non-zero', async () => {
    const { execa } = await import('execa')
    execa
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 2, stdout: '', stderr: 'no chrome' })
    const { warn, success } = await import('../../utils/exec.js')

    await installBrowser()

    expect(success).toHaveBeenCalledWith('agent-browser installed')
    expect(warn).toHaveBeenCalledWith('agent-browser install (Chrome setup) exited with non-zero code')
  })

  it('recovers from a thrown execa error', async () => {
    const { execa } = await import('execa')
    execa.mockRejectedValue(new Error('spawn npm ENOENT'))
    const { error } = await import('../../utils/exec.js')

    await installBrowser()

    expect(error).toHaveBeenCalledWith('Failed to install agent-browser: spawn npm ENOENT')
  })
})
