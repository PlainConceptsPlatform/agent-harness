import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock chalk to return the string as-is (no ANSI codes in tests)
vi.mock('chalk', () => ({
  default: {
    bold: { hex: () => (s) => s },
    green: (s) => s,
    yellow: (s) => s,
    red: (s) => s,
    dim: (s) => s,
    bgGray: { white: (s) => s },
  },
}))

// Mock ora spinner
vi.mock('ora', () => ({
  default: () => ({ start: () => ({ succeed: vi.fn(), fail: vi.fn(), stop: vi.fn() }) }),
}))

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn(),
}))

import { execa } from 'execa'
import { run, commandExists, header, success, warn, error, info, code } from './exec.js'

describe('exec utils', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('run()', () => {
    it('returns success=true when exitCode is 0', async () => {
      execa.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' })
      const result = await run('node', ['--version'])
      expect(result).toEqual({ success: true, stdout: 'ok', stderr: '' })
    })

    it('returns success=false when exitCode is non-zero', async () => {
      execa.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'error' })
      const result = await run('node', ['--bad-flag'])
      expect(result).toEqual({ success: false, stdout: '', stderr: 'error' })
    })

    it('returns success=false when execa throws', async () => {
      execa.mockRejectedValue(new Error('spawn ENOENT'))
      const result = await run('nonexistent-command', [])
      expect(result.success).toBe(false)
      expect(result.stderr).toBe('spawn ENOENT')
    })
  })

  describe('commandExists()', () => {
    it('returns true when command exits with code 0', async () => {
      execa.mockResolvedValue({ exitCode: 0 })
      expect(await commandExists('node')).toBe(true)
    })

    it('returns false when command exits with non-zero code', async () => {
      execa.mockResolvedValue({ exitCode: 1 })
      expect(await commandExists('badcmd')).toBe(false)
    })

    it('returns false when execa throws (command not found)', async () => {
      execa.mockRejectedValue(new Error('spawn ENOENT'))
      expect(await commandExists('no-such-binary')).toBe(false)
    })
  })

  describe('console helpers', () => {
    it('header() clears screen and writes output', () => {
      vi.spyOn(process.stdout, 'write').mockImplementation(() => {})
      vi.spyOn(console, 'clear').mockImplementation(() => {})
      header('Test Header')
      expect(process.stdout.write).toHaveBeenCalled()
    })

    it('success() calls console.log with text', () => {
      success('all good')
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('all good'))
    })

    it('warn() calls console.log with text', () => {
      warn('watch out')
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('watch out'))
    })

    it('error() calls console.log with text', () => {
      error('something broke')
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('something broke'))
    })

    it('info() calls console.log with text', () => {
      info('just info')
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('just info'))
    })

    it('code() calls console.log for each line', () => {
      code(['line one', 'line two'])
      // 2 lines + 2 blank lines surrounding them
      expect(console.log).toHaveBeenCalledTimes(4)
    })
  })
})
