import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../utils/exec.js')
vi.mock('../../utils/copy.js')
vi.mock('../../utils/process.js')
vi.mock('./agents.js')
vi.mock('./skills.js')

import { copyContent } from '../../utils/copy.js'
import { error } from '../../utils/exec.js'
import { copyContentStep } from './index.js'
import { exit } from '../../utils/process.js'

const copyContentMock = vi.mocked(copyContent)
const errorMock = vi.mocked(error)
const exitMock = vi.mocked(exit)

describe('copyContentStep()', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls copyContent with the correct platform and prints success', async () => {
    copyContentMock.mockResolvedValue(undefined)

    await copyContentStep('github')

    expect(copyContentMock).toHaveBeenCalledWith(
      expect.stringContaining('harness'),
      process.cwd(),
      'github',
      {}
    )
  })

  it('calls copyContent with azure platform', async () => {
    copyContentMock.mockResolvedValue(undefined)

    await copyContentStep('azure')

    expect(copyContentMock).toHaveBeenCalledWith(
      expect.stringContaining('harness'),
      process.cwd(),
      'azure',
      {}
    )
  })

  it('calls copyContent with none platform', async () => {
    copyContentMock.mockResolvedValue(undefined)

    await copyContentStep('none')

    expect(copyContentMock).toHaveBeenCalledWith(
      expect.stringContaining('harness'),
      process.cwd(),
      'none',
      {}
    )
  })

  it('calls exit(1) when copyContent throws', async () => {
    copyContentMock.mockRejectedValue(new Error('disk full'))

    await copyContentStep('github')

    expect(errorMock).toHaveBeenCalledWith(expect.stringContaining('disk full'))
    expect(exitMock).toHaveBeenCalledWith(1)
  })
})
