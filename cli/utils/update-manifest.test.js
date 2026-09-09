import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { canUpdateManagedFile, hashFile, readUpdateManifest, recordManagedFile } from './update-manifest.js'

// The manifest answers one question: did the project change this file since we
// wrote it? Answering it on raw bytes said yes for every file the harness
// itself rewrites, and yes for every file git handed back with CRLF. Both
// answers were wrong, and both are permanent, because the flag is re-derived
// from disk on every update. That is how a consumer keeps a stale skill through
// any number of updates.

let root
let source

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-manifest-'))
  source = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-shipped-'))
})

afterEach(() => {
  for (const dir of [root, source]) fs.rmSync(dir, { recursive: true, force: true })
})

const SHIPPED = [
  '# Skill',
  '',
  'Body text.',
  '',
  '<!-- PC-OPTIMIZATION-MEMORY-START -->',
  '<!-- PC-OPTIMIZATION-MEMORY-END -->',
  '',
].join('\n')

async function setup(destinationContent, { shipped = SHIPPED } = {}) {
  const sourcePath = path.join(source, 'SKILL.md')
  fs.writeFileSync(sourcePath, shipped)
  fs.writeFileSync(path.join(root, 'SKILL.md'), destinationContent)

  const manifest = await readUpdateManifest(root)
  await recordManagedFile(manifest, 'SKILL.md', sourcePath)
  return manifest
}

describe('canUpdateManagedFile', () => {
  it('updates a file that is byte-identical to what was shipped', async () => {
    const manifest = await setup(SHIPPED)
    expect(await canUpdateManagedFile('SKILL.md', root, manifest)).toBe(true)
  })

  // The patchers inject into the marker pair after the copy, so this is what an
  // untouched installed file actually looks like on disk.
  it('updates a file whose marker pair was injected into', async () => {
    const injected = SHIPPED.replace(
      '<!-- PC-OPTIMIZATION-MEMORY-START -->\n<!-- PC-OPTIMIZATION-MEMORY-END -->',
      '<!-- PC-OPTIMIZATION-MEMORY-START -->\nAgentmemory carries context across sessions.\n<!-- PC-OPTIMIZATION-MEMORY-END -->',
    )
    const manifest = await setup(injected)
    expect(await canUpdateManagedFile('SKILL.md', root, manifest)).toBe(true)
  })

  it('updates a file that came back from git with CRLF', async () => {
    const manifest = await setup(SHIPPED.replace(/\n/g, '\r\n'))
    expect(await canUpdateManagedFile('SKILL.md', root, manifest)).toBe(true)
  })

  it('updates a file that is both injected and CRLF', async () => {
    const both = SHIPPED
      .replace('<!-- PC-OPTIMIZATION-MEMORY-END -->', 'Injected line.\n<!-- PC-OPTIMIZATION-MEMORY-END -->')
      .replace(/\n/g, '\r\n')
    const manifest = await setup(both)
    expect(await canUpdateManagedFile('SKILL.md', root, manifest)).toBe(true)
  })

  it('preserves a file the project actually edited', async () => {
    const manifest = await setup(SHIPPED.replace('Body text.', 'Body text, plus our own rule.'))
    expect(await canUpdateManagedFile('SKILL.md', root, manifest)).toBe(false)
  })

  it('preserves a file it has no record of', async () => {
    fs.writeFileSync(path.join(root, 'SKILL.md'), SHIPPED)
    const manifest = await readUpdateManifest(root)
    expect(await canUpdateManagedFile('SKILL.md', root, manifest)).toBe(false)
  })

  it('updates a file that does not exist yet', async () => {
    const manifest = await readUpdateManifest(root)
    expect(await canUpdateManagedFile('missing.md', root, manifest)).toBe(true)
  })

  // Consumers in the field carry manifests written before this comparison
  // existed, holding raw source hashes. Those have to keep working, or the
  // first update after this change preserves everything it should replace.
  it('still honours a legacy raw hash', async () => {
    const sourcePath = path.join(source, 'SKILL.md')
    fs.writeFileSync(sourcePath, SHIPPED)
    fs.writeFileSync(path.join(root, 'SKILL.md'), SHIPPED)

    const manifest = await readUpdateManifest(root)
    manifest.files['SKILL.md'] = await hashFile(sourcePath)

    expect(await canUpdateManagedFile('SKILL.md', root, manifest)).toBe(true)
  })
})
