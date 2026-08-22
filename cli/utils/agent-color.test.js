import { describe, expect, it } from 'vitest'
import { RESERVED_COLORS, agentColor, colorLineFor, shouldDeriveColor, yamlColor } from './agent-color.js'

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

/**
 * Parse a frontmatter scalar the way YAML does, so these tests exercise the
 * actual failure: an unquoted `#` opens a comment and the value becomes empty.
 */
function parseYamlScalar(line) {
  const raw = line.slice(line.indexOf(':') + 1).trim()
  if (raw.startsWith('"') || raw.startsWith("'")) return raw.slice(1, -1)
  return raw.split('#')[0].trim()
}

describe('yamlColor()', () => {
  // The bug: `color: #D83155` parsed as null and opencode refused the agent
  // with "Invalid input color".
  it('quotes a hex so YAML does not read it as a comment', () => {
    expect(yamlColor('#D83155')).toBe('"#D83155"')
    expect(parseYamlScalar(`color: ${yamlColor('#D83155')}`)).toBe('#D83155')
  })

  it('shows why the bare form was broken', () => {
    expect(parseYamlScalar('color: #D83155')).toBe('')
  })

  it('leaves theme keywords bare', () => {
    expect(yamlColor('primary')).toBe('primary')
    expect(yamlColor('warning')).toBe('warning')
  })

  it('round-trips every derived colour through a YAML parse', () => {
    for (let i = 0; i < 200; i++) {
      const name = `agent-${i}-engineer`
      const colour = agentColor(name)
      expect(parseYamlScalar(`color: ${yamlColor(colour)}`)).toBe(colour)
    }
  })
})

describe('colorLineFor()', () => {
  it('repairs an unquoted hex without changing the colour', () => {
    expect(colorLineFor('backend-engineer', '#D83155')).toBe('color: "#D83155"')
  })

  it('is a no-op once the line is already correct', () => {
    expect(colorLineFor('backend-engineer', '"#D83155"')).toBeNull()
    expect(colorLineFor('build', 'primary')).toBeNull()
  })

  it('derives and quotes when the colour is missing', () => {
    expect(colorLineFor('butterfly-engineer', undefined)).toBe(`color: ${yamlColor(agentColor('butterfly-engineer'))}`)
  })

  it('replaces a theme keyword on a non-primary', () => {
    const line = colorLineFor('backend-engineer', 'info')
    expect(line).toBe(`color: ${yamlColor(agentColor('backend-engineer'))}`)
    expect(line).toContain('"#')
  })

  it('keeps a deliberate hex, only fixing its quoting', () => {
    expect(colorLineFor('backend-engineer', '#123456')).toBe('color: "#123456"')
    expect(colorLineFor('backend-engineer', '"#123456"')).toBeNull()
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
      new URL('../../harness/.opencode/plugins/pc-subagent-tiers.js', import.meta.url),
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
