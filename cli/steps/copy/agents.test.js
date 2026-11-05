import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import fse from 'fs-extra'
import { patchAgentGuidance, reuseBlock } from './agents.js'

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
    expect(content).toContain('<!-- PC-PLATFORM-SKILLS-START -->')
    expect(content).toContain('<!-- PC-PLATFORM-SKILLS-END -->')
  })

  it('appends the mandatory-skills block to an install that predates the markers', async () => {
    const dest = path.join(tmpDir, 'AGENTS.md')
    await fse.writeFile(dest, '# AGENTS.md\n\n## Skills\n\nSkills live in `.agents/skills/`.\n')

    await patchAgentGuidance('github', 'github', tmpDir)

    const content = await fse.readFile(dest, 'utf-8')
    expect(content).toContain('## Mandatory skills')
    expect(content).toContain('<!-- PC-PLATFORM-SKILLS-START -->')
    expect(content).toContain('<!-- PC-PLATFORM-SKILLS-END -->')
    expect(content).toContain('.agents/skills/pc-guardrails-generic/SKILL.md')
    expect(content).toContain('.agents/skills/pc-guardrails-project/SKILL.md')
    expect(content.match(/PC-PLATFORM-SKILLS-START/g)).toHaveLength(1)
  })

  it('replaces the block in place on repeated updates', async () => {
    const source = path.join(process.cwd(), 'harness', 'AGENTS.md')
    const dest = path.join(tmpDir, 'AGENTS.md')
    await fse.copyFile(source, dest)

    await patchAgentGuidance('github', 'github', tmpDir)
    await patchAgentGuidance('github', 'github', tmpDir)

    const content = await fse.readFile(dest, 'utf-8')
    expect(content.match(/PC-PLATFORM-SKILLS-START/g)).toHaveLength(1)
    expect(content).not.toContain('## Mandatory skills')
    expect(content).toContain('.agents/skills/pc-guardrails-generic/SKILL.md')
  })
})

describe('reuse before you build', () => {
  let tmpDir
  const write = (file, text) => fse.outputFile(path.join(tmpDir, file), text)
  const patched = async () => {
    await patchAgentGuidance('github', 'github', tmpDir)
    return fse.readFile(path.join(tmpDir, 'AGENTS.md'), 'utf-8')
  }

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-contract-test-'))
    await fse.copyFile(path.join(process.cwd(), 'harness', 'AGENTS.md'), path.join(tmpDir, 'AGENTS.md'))
  })

  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }))

  it('writes the block from reuse once, and empties it when the contract goes', async () => {
    await write('.platform/contract.yml', 'version: 1\nsource:\n  name: Acme app template\n  url: https://github.com/acme/app-template\n  changes: https://github.com/acme/app-template/issues/new\nowned: [src/platform/**]\nreuse:\n  docs: [docs/platform/]\n  packages: ["@acme/ui"]\n  names: [DataTable]\n')
    await patched()
    const content = await patched()

    expect(content.split('<!-- PC-PLATFORM-CONTRACT-START -->')).toHaveLength(2)
    expect(content.slice(content.indexOf('<!-- PC-PLATFORM-CONTRACT-START -->'))).toBe(`<!-- PC-PLATFORM-CONTRACT-START -->
## Reuse before you build

This repository receives shared code from Acme app template (https://github.com/acme/app-template), declared in \`.platform/contract.yml\`.

- Never design something new before reading \`docs/platform/\`.
- Never re-implement an export of \`@acme/ui\`; import it.
- Never write your own \`DataTable\`; reuse the existing one.
- Never edit a path listed under \`owned\`. Ask for the change at https://github.com/acme/app-template/issues/new, or add a dated exception to \`.platform/exceptions.yml\`.
<!-- PC-PLATFORM-CONTRACT-END -->
`)

    await fse.remove(path.join(tmpDir, '.platform'))
    expect(await patched()).toContain('<!-- PC-PLATFORM-CONTRACT-START -->\n<!-- PC-PLATFORM-CONTRACT-END -->')
  })

  it('keeps the reuse rules but not the owned-path rule in the template itself', () => {
    const contract = { source: { name: 'Acme', url: 'u', changes: 'u' }, reuse: { names: ['DataTable'] }, exceptions: 'e.yml' }
    expect(reuseBlock(contract, true)).toContain('reuse the existing one')
    expect(reuseBlock(contract, true)).not.toContain('Never edit a path')
  })

  it('adds nothing without a contract, with the legacy one, or with an invalid one', async () => {
    const without = await patched()
    expect(without).not.toContain('PC-PLATFORM-CONTRACT')
    await write('.copier-answers.yml', '_src_path: https://github.com/acme/app-template.git\n')
    await write('.platform/manifest', 'src/platform/**\n')
    expect(await patched()).toBe(without)
    await write('.platform/contract.yml', 'version: 1\n')
    expect(await patched()).toBe(without)
  })
})
