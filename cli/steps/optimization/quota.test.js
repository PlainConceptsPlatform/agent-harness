import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { splitPackageSpec } from './quota.js'

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
