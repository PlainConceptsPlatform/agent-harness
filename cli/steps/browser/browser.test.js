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
      installer: { command: 'npm', args: ['install', '-g', '@opencode/browse@0.0.14'] },
      setup: { command: 'browse', args: ['install', '--yes'] },
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

  it('runs the npm install and browse setup from preset', async () => {
    const { execa } = await import('execa')
    execa.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })

    await installBrowser()

    expect(execa).toHaveBeenNthCalledWith(1, 'npm', ['install', '-g', '@opencode/browse@0.0.14'], expect.any(Object))
    expect(execa).toHaveBeenNthCalledWith(2, 'browse', ['install', '--yes'], expect.any(Object))
  })

  it('logs success when both steps exit 0', async () => {
    const { execa } = await import('execa')
    execa.mockResolvedValue({ exitCode: 0, stdout: 'paired', stderr: '' })
    const { success } = await import('../../utils/exec.js')

    await installBrowser()

    expect(success).toHaveBeenCalledWith('browse installed')
    expect(success).toHaveBeenCalledWith('browse paired with your browser')
  })

  it('warns and skips setup when npm install fails', async () => {
    const { execa } = await import('execa')
    execa.mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'engine incompat' })
    const { warn, success, info } = await import('../../utils/exec.js')

    await installBrowser()

    expect(warn).toHaveBeenCalledWith('browse npm install exited with non-zero code')
    expect(info).toHaveBeenCalledWith('engine incompat')
    expect(success).not.toHaveBeenCalledWith('browse installed')
    expect(execa).toHaveBeenCalledTimes(1)
  })

  it('warns when browse setup exits non-zero (extension not paired in time)', async () => {
    const { execa } = await import('execa')
    execa
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 2, stdout: '', stderr: 'no extension' })
    const { warn, success } = await import('../../utils/exec.js')

    await installBrowser()

    expect(success).toHaveBeenCalledWith('browse installed')
    expect(warn).toHaveBeenCalledWith('browse setup did not complete — install the extension and run `browse pair`')
  })

  it('recovers from a thrown execa error', async () => {
    const { execa } = await import('execa')
    execa.mockRejectedValue(new Error('spawn npm ENOENT'))
    const { error } = await import('../../utils/exec.js')

    await installBrowser()

    expect(error).toHaveBeenCalledWith('Failed to install browse: spawn npm ENOENT')
  })
})
