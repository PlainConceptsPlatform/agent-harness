import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

vi.mock('../../utils/exec.js')
vi.mock('../../utils/process.js')

import { success } from '../../utils/exec.js'
import { writeModelsToConfigs } from './write.js'

describe('writeModelsToConfigs()', () => {
  let tmpDir

  beforeEach(() => {
    vi.clearAllMocks()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'models-config-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes build model to opencode.jsonc', async () => {
    const opencodeJsonPath = path.join(tmpDir, 'opencode.jsonc')
    fs.writeFileSync(opencodeJsonPath, JSON.stringify({ theme: 'dark' }, null, 2), 'utf-8')

    await writeModelsToConfigs({ buildModel: 'build-model', cwd: tmpDir })

    const config = JSON.parse(fs.readFileSync(opencodeJsonPath, 'utf-8'))
    expect(config.model).toBe('build-model')
    expect(success).toHaveBeenCalledWith(expect.stringContaining('build-model'))
  })


  it('removes the default model when no build model is passed', async () => {
    const opencodeJsonPath = path.join(tmpDir, 'opencode.jsonc')
    fs.writeFileSync(opencodeJsonPath, JSON.stringify({ model: 'old-model', theme: 'dark' }, null, 2), 'utf-8')

    await writeModelsToConfigs({ buildModel: null, cwd: tmpDir })

    expect(JSON.parse(fs.readFileSync(opencodeJsonPath, 'utf-8'))).toEqual({ theme: 'dark' })
    expect(success).not.toHaveBeenCalled()
  })
})
