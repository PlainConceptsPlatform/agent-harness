import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./shared.js', () => ({ readHarnessConfig: vi.fn() }))
vi.mock('../steps/copy/index.js', () => ({ copyContentStep: vi.fn() }))
vi.mock('../steps/models/write.js', () => ({ writeModelsToConfigs: vi.fn() }))
vi.mock('../steps/optimization/patch-guardrails.js', () => ({ patchGuardrails: vi.fn() }))
vi.mock('../steps/metadata/index.js', () => ({ writeHarnessConfig: vi.fn() }))
vi.mock('../utils/process.js', () => ({ exit: vi.fn() }))

import { readHarnessConfig } from './shared.js'
import { copyContentStep } from '../steps/copy/index.js'
import { patchGuardrails } from '../steps/optimization/patch-guardrails.js'
import { runUpdate } from './update.js'

describe('runUpdate()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readHarnessConfig.mockResolvedValue({
      platform: { backlog: 'github', repo: 'github' },
      agents: { maxConcurrent: 3 },
      tools: { humanizer: true },
    })
  })

  it('restores every saved optional tool selection', async () => {
    await runUpdate()

    expect(copyContentStep).toHaveBeenCalledWith(
      { backlogPlatform: 'github', repoPlatform: 'github' },
      expect.objectContaining({ updateMode: true }),
    )
    expect(copyContentStep.mock.calls[0][1].forceOverwrite).toBeUndefined()
    expect(patchGuardrails).toHaveBeenCalledWith(expect.objectContaining({ humanizer: true }))
  })

})
