import { describe, it, expect } from 'vitest'
import { CANONICAL_PROVIDERS, parseModels } from './models-pricing.js'

describe('CANONICAL_PROVIDERS', () => {
  it('contains expected major providers', () => {
    expect(CANONICAL_PROVIDERS).toContain('anthropic')
    expect(CANONICAL_PROVIDERS).toContain('openai')
    expect(CANONICAL_PROVIDERS).toContain('google')
  })
})

describe('parseModels()', () => {
  it('filters to tool-calling models only', () => {
    const data = {
      anthropic: {
        models: {
          'claude-3-sonnet': { name: 'Claude 3 Sonnet', tool_call: true, cost: { input: 3 } },
          'claude-3-haiku': { name: 'Claude 3 Haiku', tool_call: false, cost: { input: 0.25 } },
        },
      },
    }

    const result = parseModels(data)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('anthropic/claude-3-sonnet')
  })

  it('builds canonical cost lookup from authoritative providers', () => {
    const data = {
      anthropic: {
        models: {
          'claude-3-5-sonnet': { name: 'Claude 3.5 Sonnet', tool_call: true, cost: { input: 3 } },
        },
      },
      'some-reseller': {
        models: {
          'claude-3-5-sonnet': { name: 'Claude 3.5 Sonnet', tool_call: true, cost: { input: 0 } },
        },
      },
    }

    const result = parseModels(data)

    expect(result).toHaveLength(2)
    const reseller = result.find(m => m.id.startsWith('some-reseller'))
    expect(reseller?.canonicalCost).toBe(3)
  })

  it('sorts by cost ascending', () => {
    const data = {
      openai: {
        models: {
          'gpt-4': { name: 'GPT-4', tool_call: true, cost: { input: 30 } },
          'gpt-3.5-turbo': { name: 'GPT-3.5 Turbo', tool_call: true, cost: { input: 0.5 } },
        },
      },
    }

    const result = parseModels(data)

    expect(result[0].cost).toBe(0.5)
    expect(result[1].cost).toBe(30)
  })

  it('handles missing cost', () => {
    const data = {
      test: {
        models: {
          'unknown-model': { name: 'Unknown', tool_call: true },
        },
      },
    }

    const result = parseModels(data)

    expect(result[0].cost).toBeUndefined()
  })

  it('extracts context limit', () => {
    const data = {
      anthropic: {
        models: {
          'claude-3-opus': { name: 'Claude 3 Opus', tool_call: true, cost: { input: 15 }, limit: { context: 200000 } },
        },
      },
    }

    const result = parseModels(data)

    expect(result[0].context).toBe(200000)
  })
})