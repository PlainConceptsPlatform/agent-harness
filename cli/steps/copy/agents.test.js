import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import fse from 'fs-extra'
import { patchAgentGuidance } from './agents.js'

describe('platform patching', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-patch-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('patches AGENTS.md for none mode with raw-conversation workflow', async () => {
    const source = path.join(process.cwd(), 'harness', 'AGENTS.md')
    const dest = path.join(tmpDir, 'AGENTS.md')
    await fse.copyFile(source, dest)

    await patchAgentGuidance('none', 'none', tmpDir)

    const content = await fse.readFile(dest, 'utf-8')
    // `none` is the one mode where a platform URL means nothing, so the
    // injected workflow has to say so rather than describing a pipeline.
    expect(content).toContain('is not a trigger in this mode')
    expect(content).toContain('the local repository is the only context')
    expect(content).not.toContain('means run the pipeline, in whatever words')
  })

  it('preserves the operating-guide structure and platform markers', async () => {
    const source = path.join(process.cwd(), 'harness', 'AGENTS.md')
    const dest = path.join(tmpDir, 'AGENTS.md')
    await fse.copyFile(source, dest)

    await patchAgentGuidance('github', 'github', tmpDir)

    const content = await fse.readFile(dest, 'utf-8')
    expect(content).toContain('# Agent operating guide')
    expect(content).toContain('## Session context')
    expect(content).toContain('## Tool and repository safety')
    expect(content).toContain('## Verification and completion')
    expect(content).toContain('<!-- PC-PLATFORM-WORKFLOW-START -->')
    expect(content).toContain('<!-- PC-PLATFORM-WORKFLOW-END -->')
    expect(content).toContain('<!-- PC-PLATFORM-SKILLS-GUIDE-START -->')
    expect(content).toContain('<!-- PC-PLATFORM-SKILLS-GUIDE-END -->')
  })
})
