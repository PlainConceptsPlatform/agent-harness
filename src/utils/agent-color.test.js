import { describe, expect, it } from 'vitest'
import { RESERVED_COLORS, agentColor, shouldDeriveColor } from './agent-color.js'

function toRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

describe('agentColor()', () => {
  it('gives the primaries their reserved theme colours', () => {
    expect(agentColor('build')).toBe('primary')
    expect(agentColor('plan')).toBe('warning')
    expect(RESERVED_COLORS).toEqual({ build: 'primary', plan: 'warning' })
  })

  // The whole point: a butterfly-engineer looks the same in every project.
  it('is stable for a given name', () => {
    expect(agentColor('butterfly-engineer')).toBe(agentColor('butterfly-engineer'))
    expect(agentColor('frontend-engineer')).toBe(agentColor('frontend-engineer'))
  })

  it('gives different names different colours', () => {
    const names = ['frontend-engineer', 'backend-engineer', 'docs-engineer', 'butterfly-engineer', 'fullstack-engineer']
    expect(new Set(names.map(agentColor)).size).toBe(names.length)
  })

  it('always returns a full six-digit hex', () => {
    for (const name of ['a', 'frontend-engineer', 'x'.repeat(200), 'ácentéd-engineer']) {
      expect(agentColor(name)).toMatch(/^#[0-9A-F]{6}$/)
    }
  })

  // Fixed saturation and lightness exist to guarantee this. A hashed lightness
  // would eventually produce an agent invisible against one of the themes.
  it('never produces black, white or grey', () => {
    const names = Array.from({ length: 300 }, (_, i) => `agent-${i}-engineer`)
    for (const name of names) {
      const [r, g, b] = toRgb(agentColor(name))
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      expect(max - min).toBeGreaterThan(40)     // saturated, so not grey
      expect(max).toBeGreaterThan(80)           // not near-black
      expect(min).toBeLessThan(215)             // not near-white
    }
  })

  it('spreads colours around the wheel', () => {
    const hues = new Set(
      Array.from({ length: 60 }, (_, i) => agentColor(`agent-${i}`)),
    )
    // A bad hash would collapse these onto a handful of values.
    expect(hues.size).toBeGreaterThan(50)
  })
})

// The shipped plugin has to stand alone in the consumer repo, so it carries its
// own copy of this hash. If the two drift, the same agent changes colour when
// the plugin regenerates a file the CLI wrote, which is exactly the churn the
// derived colour is meant to avoid.
describe('plugin parity', () => {
  it('the plugin derives the same colours as the CLI', async () => {
    const fs = await import('node:fs')
    const url = await import('node:url')
    const pluginPath = url.fileURLToPath(
      new URL('../content/.opencode/plugins/pc-subagent-tiers.js', import.meta.url),
    )
    const source = fs.readFileSync(pluginPath, 'utf-8')

    // Lift the plugin's own agentColor out of its source and run it directly.
    const start = source.indexOf('function agentColor(name) {')
    expect(start).toBeGreaterThan(-1)
    const end = source.indexOf('\n}', start) + 2
    const pluginColor = new Function(`${source.slice(start, end)}; return agentColor`)()

    for (const name of ['fullstack-engineer', 'frontend-engineer', 'backend-engineer', 'docs-engineer', 'butterfly-engineer', 'a', 'zzz']) {
      expect(pluginColor(name)).toBe(agentColor(name))
    }
  })
})

describe('shouldDeriveColor()', () => {
  it('replaces a missing colour', () => {
    expect(shouldDeriveColor(undefined)).toBe(true)
    expect(shouldDeriveColor('')).toBe(true)
  })

  // These came from the old template, which asked for a hand-picked keyword.
  it('replaces a theme keyword', () => {
    for (const c of ['primary', 'secondary', 'accent', 'success', 'warning', 'error', 'info', ' INFO ']) {
      expect(shouldDeriveColor(c)).toBe(true)
    }
  })

  it('leaves a deliberate hex alone', () => {
    expect(shouldDeriveColor('#FF5733')).toBe(false)
    expect(shouldDeriveColor('#abcdef')).toBe(false)
  })
})
