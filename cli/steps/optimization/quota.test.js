import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/exec.js', () => ({
  error: vi.fn(),
  header: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
}))

import { installQuota, splitPackageSpec } from './quota.js'

const preset = JSON.parse(
  fs.readFileSync(new URL('../../presets/quota.json', import.meta.url), 'utf-8'),
)

describe('splitPackageSpec()', () => {
  it('splits an exact scoped package version', () => {
    expect(splitPackageSpec('@slkiser/opencode-quota@4.2.0')).toEqual({
      name: '@slkiser/opencode-quota',
      version: '4.2.0',
    })
  })

  it('keeps unversioned packages on latest', () => {
    expect(splitPackageSpec('@example/plugin')).toEqual({
      name: '@example/plugin',
      version: 'latest',
    })
  })
})

describe('quota defaults', () => {
  it('silences popups and notifications but keeps the sidebar', () => {
    expect(preset.defaults.enableToast).toBe(false)
    expect(preset.defaults.resetNotifications).toEqual({ enabled: false })
    expect(preset.defaults.tuiCommandDisplay).toBe('inline')
    expect(preset.defaults.tuiCompactStatus).toEqual({ enabled: false })
    expect(preset.defaults.tuiPromptBar).toEqual({ enabled: false })
    expect(preset.defaults.tuiSidebarPanel).toEqual({ enabled: true })
  })
})

describe('installQuota()', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quota-test-'))
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function readJson(relative) {
    return JSON.parse(fs.readFileSync(path.join(tmpDir, relative), 'utf-8'))
  }

  it('writes settings to the repository root where 5.x reads them', async () => {
    await installQuota({ skipHeader: true, skipPrompt: true })

    const settings = readJson('opencode-quota/quota-toast.jsonc')
    expect(settings.enableToast).toBe(false)
    expect(readJson('opencode.jsonc').plugins).toEqual(['@slkiser/opencode-quota@5.0.3'])
    expect(readJson('.opencode/package.json').dependencies['@slkiser/opencode-quota']).toBe('5.0.3')
    expect(fs.existsSync(path.join(tmpDir, '.opencode', 'opencode-quota'))).toBe(false)
  })

  it('migrates v4 settings out of .opencode and upgrades the pin in place', async () => {
    fs.mkdirSync(path.join(tmpDir, '.opencode', 'opencode-quota'), { recursive: true })
    fs.writeFileSync(
      path.join(tmpDir, '.opencode', 'opencode-quota', 'quota-toast.json'),
      JSON.stringify({ enableToast: true, custom: 'kept' }),
    )
    fs.writeFileSync(
      path.join(tmpDir, 'opencode.jsonc'),
      JSON.stringify({ plugins: ['@slkiser/opencode-quota@4.2.0', 'other-plugin'] }),
    )

    await installQuota({ skipHeader: true, skipPrompt: true })

    const settings = readJson('opencode-quota/quota-toast.jsonc')
    expect(settings.enableToast).toBe(false)
    expect(settings.custom).toBe('kept')
    expect(fs.existsSync(path.join(tmpDir, '.opencode', 'opencode-quota'))).toBe(false)
    expect(readJson('opencode.jsonc').plugins).toEqual([
      '@slkiser/opencode-quota@5.0.3',
      'other-plugin',
    ])
  })
})
