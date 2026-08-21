import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import os from 'os'
import fse from 'fs-extra'

// Use real fs-extra for file system tests (temp dirs)
import { copyContent, findAiFiles } from './copy.js'
import { hashFile, writeUpdateManifest } from './update-manifest.js'

const tmpDir = () => fse.mkdtempSync(path.join(os.tmpdir(), 'pc-test-'))
const aiFiles = [
  'AGENTS.md',
  'CLAUDE.md',
  '.cursorrules',
  '.clinerules',
  '.github/copilot-instructions.md',
]

describe('copy utils', () => {
  describe('findAiFiles()', () => {
    let dir

    beforeEach(() => {
      dir = tmpDir()
    })

    afterEach(async () => {
      await fse.remove(dir)
    })

    it('returns empty array when no AI files exist', async () => {
      const found = await findAiFiles(dir, aiFiles)
      expect(found).toEqual([])
    })

    it('detects AGENTS.md', async () => {
      await fse.writeFile(path.join(dir, 'AGENTS.md'), '# agents')
      const found = await findAiFiles(dir, aiFiles)
      expect(found).toHaveLength(1)
      expect(found[0]).toContain('AGENTS.md')
    })

    it('detects CLAUDE.md', async () => {
      await fse.writeFile(path.join(dir, 'CLAUDE.md'), '# claude')
      const found = await findAiFiles(dir, aiFiles)
      expect(found).toHaveLength(1)
      expect(found[0]).toContain('CLAUDE.md')
    })

    it('detects multiple AI files at once', async () => {
      await fse.writeFile(path.join(dir, 'AGENTS.md'), '')
      await fse.writeFile(path.join(dir, '.cursorrules'), '')
      await fse.writeFile(path.join(dir, '.clinerules'), '')
      const found = await findAiFiles(dir, aiFiles)
      expect(found).toHaveLength(3)
    })

    it('detects nested copilot-instructions.md', async () => {
      const ghDir = path.join(dir, '.github')
      await fse.ensureDir(ghDir)
      await fse.writeFile(path.join(ghDir, 'copilot-instructions.md'), '')
      const found = await findAiFiles(dir, aiFiles)
      expect(found).toHaveLength(1)
      expect(found[0]).toContain('copilot-instructions.md')
    })
  })

  describe('copyContent()', () => {
    let src, dest

    beforeEach(async () => {
      src = tmpDir()
      dest = tmpDir()
    })

    afterEach(async () => {
      await fse.remove(src)
      await fse.remove(dest)
    })

    it('copies files that match neither platform exclusion', async () => {
      await fse.writeFile(path.join(src, 'AGENTS.md'), '# agents')
      await copyContent(src, dest, 'github')
      expect(await fse.pathExists(path.join(dest, 'AGENTS.md'))).toBe(true)
    })

    it('always excludes .bootstrap folder', async () => {
      await fse.ensureDir(path.join(src, '.bootstrap'))
      await fse.writeFile(path.join(src, '.bootstrap', 'secret.md'), 'internal')

      await copyContent(src, dest, 'github')

      expect(await fse.pathExists(path.join(dest, '.bootstrap', 'secret.md'))).toBe(false)
    })

    it('excludes plugin test files from generated projects', async () => {
      const pluginPath = path.join(src, '.opencode', 'plugins', 'example.test.js')
      await fse.ensureDir(path.dirname(pluginPath))
      await fse.writeFile(pluginPath, 'test source')

      await copyContent(src, dest, 'github')

      expect(await fse.pathExists(path.join(dest, '.opencode', 'plugins', 'example.test.js'))).toBe(false)
    })

    it('does not overwrite existing files', async () => {
      await fse.writeFile(path.join(src, 'AGENTS.md'), 'new content')
      await fse.writeFile(path.join(dest, 'AGENTS.md'), 'original content')

      await copyContent(src, dest, 'github')

      const content = await fse.readFile(path.join(dest, 'AGENTS.md'), 'utf-8')
      expect(content).toBe('original content')
    })

    it('copies github-specific files when platform is github', async () => {
      await fse.writeFile(path.join(src, 'agent-gh.md'), 'github agent')
      await copyContent(src, dest, 'github')
      expect(await fse.pathExists(path.join(dest, 'agent-gh.md'))).toBe(true)
    })

    it('copies azure-specific files when platform is azure', async () => {
      await fse.writeFile(path.join(src, 'agent-az.md'), 'azure agent')
      await copyContent(src, dest, 'azure')
      expect(await fse.pathExists(path.join(dest, 'agent-az.md'))).toBe(true)
    })

    it('never overwrites openspec/config.yaml even with forceOverwrite', async () => {
      await fse.ensureDir(path.join(src, 'openspec'))
      await fse.writeFile(path.join(src, 'openspec', 'config.yaml'), 'template')
      await fse.ensureDir(path.join(dest, 'openspec'))
      await fse.writeFile(path.join(dest, 'openspec', 'config.yaml'), 'user customized')

      await copyContent(src, dest, 'github', { forceOverwrite: true })

      const content = await fse.readFile(path.join(dest, 'openspec', 'config.yaml'), 'utf-8')
      expect(content).toBe('user customized')
    })

    it('never overwrites opencode.jsonc even with forceOverwrite', async () => {
      await fse.writeFile(path.join(src, 'opencode.jsonc'), '{"template":true}')
      await fse.writeFile(path.join(dest, 'opencode.jsonc'), '{"user":true}')

      await copyContent(src, dest, 'github', { forceOverwrite: true })

      const content = await fse.readFile(path.join(dest, 'opencode.jsonc'), 'utf-8')
      expect(JSON.parse(content).user).toBe(true)
    })

    it('updates an unchanged managed file when its source changes', async () => {
      const sourcePath = path.join(src, '.opencode', 'plugins', 'monitor.js')
      const destinationPath = path.join(dest, '.opencode', 'plugins', 'monitor.js')
      await fse.ensureDir(path.dirname(sourcePath))
      await fse.writeFile(sourcePath, 'v2')
      await fse.ensureDir(path.dirname(destinationPath))
      await fse.writeFile(destinationPath, 'v1')
      await writeUpdateManifest({ files: { '.opencode/plugins/monitor.js': await hashFile(destinationPath) } }, dest)

      await copyContent(src, dest, 'github', { updateMode: true })

      expect(await fse.readFile(destinationPath, 'utf-8')).toBe('v2')
    })

    it('preserves a modified managed file during update', async () => {
      const sourcePath = path.join(src, '.opencode', 'plugins', 'monitor.js')
      const destinationPath = path.join(dest, '.opencode', 'plugins', 'monitor.js')
      await fse.ensureDir(path.dirname(sourcePath))
      await fse.writeFile(sourcePath, 'v2')
      await fse.ensureDir(path.dirname(destinationPath))
      await fse.writeFile(destinationPath, 'user customization')
      await writeUpdateManifest({ files: { '.opencode/plugins/monitor.js': 'hash-of-v1' } }, dest)

      await copyContent(src, dest, 'github', { updateMode: true })

      expect(await fse.readFile(destinationPath, 'utf-8')).toBe('user customization')
    })

    it('does not overwrite existing unmanaged files during update', async () => {
      await fse.writeFile(path.join(src, 'AGENTS.md'), 'template')
      await fse.writeFile(path.join(dest, 'AGENTS.md'), 'project rules')

      await copyContent(src, dest, 'github', { updateMode: true })

      expect(await fse.readFile(path.join(dest, 'AGENTS.md'), 'utf-8')).toBe('project rules')
    })
  })
})
