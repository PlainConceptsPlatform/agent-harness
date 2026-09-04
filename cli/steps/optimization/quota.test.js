import { describe, expect, it } from 'vitest'
import { splitPackageSpec } from './quota.js'

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
