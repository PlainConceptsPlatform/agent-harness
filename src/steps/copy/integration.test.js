// Integration tests that run the install-time patchers against the REAL
// content/ templates. The unit tests mock the filesystem and preset layers,
// which is exactly where src/ and content/ have historically drifted apart
// (heading renames, skill gating, double-escaped preset strings). These tests
// fail the moment either side changes shape without the other.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('execa', () => ({ execa: vi.fn().mockResolvedValue({ exitCode: 0 }) }))
vi.mock('../../utils/exec.js')

import { patchAgentsMd, patchAgentGuidance } from './agents.js'
import { installSkills } from './skills.js'
import { patchOpsShip, patchOpsReview, patchOpsBacklog, patchOpsEvidence } from './commands.js'
import { resolvePlatform } from '../../commands/single.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTENT_DIR = path.resolve(__dirname, '../../content')
const REAL_AGENTS_MD = fs.readFileSync(path.join(CONTENT_DIR, 'AGENTS.md'), 'utf-8')
const REAL_OB_INIT_MD = fs.readFileSync(path.join(CONTENT_DIR, '.agents', 'skills', 'ob-repo-initialize', 'SKILL.md'), 'utf-8')

let tmpDir

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onboard-integration-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

describe('patchAgentsMd against the real ob-repo-initialize SKILL.md', () => {
  it('leaves the file untouched when nothing exists yet', async () => {
    fs.mkdirSync(path.join(tmpDir, '.agents', 'skills', 'ob-repo-initialize'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, '.agents', 'skills', 'ob-repo-initialize', 'SKILL.md'), REAL_OB_INIT_MD)
    await patchAgentsMd({})
    expect(fs.readFileSync(path.join(tmpDir, '.agents', 'skills', 'ob-repo-initialize', 'SKILL.md'), 'utf-8')).toBe(REAL_OB_INIT_MD)
  })
})

describe('patchAgentGuidance mixed platforms against the real template', () => {
  it.each([
    ['azure', 'github'],
    ['jira', 'gitlab'],
    ['browser', 'azure'],
    ['github', 'gitlab'],
  ])('backlog=%s repo=%s injects clean text with intact markers', async (backlog, repo) => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), REAL_AGENTS_MD)

    await patchAgentGuidance(backlog, repo, tmpDir)

    const patched = fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf-8')
    // No double-escaped preset strings may ever reach the installed file.
    expect(patched).not.toContain('\\n')
    // Markers must survive so optimization re-runs can re-patch.
    for (const marker of [
      'OB-PLATFORM-WORKFLOW-START', 'OB-PLATFORM-WORKFLOW-END',
      'OB-PLATFORM-SKILLS-GUIDE-START', 'OB-PLATFORM-SKILLS-GUIDE-END',
    ]) {
      expect(patched).toContain(marker)
    }
  })
})

describe('installSkills platform gating (real content/.agents/skills)', () => {
  async function installedSkill(name) {
    const p = path.join(tmpDir, '.agents', 'skills', name, 'SKILL.md')
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null
  }

  it('azure backlog + gitlab repo: azure userstory, gitlab ops commands', async () => {
    await installSkills('azure', 'gitlab')
    expect(await installedSkill('ob-userstory')).toContain('az boards work-item show')
    expect(await installedSkill('ob-ship')).toBeNull()
    expect(await installedSkill('ob-review')).toBeNull()
    expect(await installedSkill('ob-backlog')).toBeNull()
  })

  it('jira backlog + github repo: jira userstory, github ops commands', async () => {
    await installSkills('jira', 'github')
    expect(await installedSkill('ob-userstory')).toContain('acli jira workitem view')
    expect(await installedSkill('ob-ship')).toBeNull()
    expect(await installedSkill('ob-review')).toBeNull()
    expect(await installedSkill('ob-backlog')).toBeNull()
  })

  it('github backlog + none repo: github userstory, NO ops skills', async () => {
    await installSkills('github', 'none')
    expect(await installedSkill('ob-userstory')).toContain('gh issue view')
    expect(await installedSkill('ob-ship')).toBeNull()
    expect(await installedSkill('ob-review')).toBeNull()
    expect(await installedSkill('ob-backlog')).toBeNull()
  })

  it('browser backlog + azure repo: browser userstory, NO ops skills', async () => {
    await installSkills('browser', 'azure')
    expect(await installedSkill('ob-userstory')).toContain('browser_open_tab')
    expect(await installedSkill('ob-ship')).toBeNull()
    expect(await installedSkill('ob-review')).toBeNull()
    expect(await installedSkill('ob-backlog')).toBeNull()
  })

  it('update mode replaces shipped ob skills and preserves project-generated skills', async () => {
    const skillsDir = path.join(tmpDir, '.agents', 'skills')
    // A project-generated skill (not shipped by opencode-onboard): must survive update.
    // Use a name that does NOT exist in content/.agents/skills/ to model a real
    // project-generated skill like ob-merge-risk-assess or ob-guardrails-project
    // after /make-guardrails has overwritten the shipped placeholder.
    const projectSkill = path.join(skillsDir, 'ob-merge-risk-assess')
    // A non-ob user skill: must survive update.
    const userSkill = path.join(skillsDir, 'project-workflow')
    fs.mkdirSync(projectSkill, { recursive: true })
    fs.mkdirSync(userSkill, { recursive: true })
    fs.writeFileSync(path.join(projectSkill, 'SKILL.md'), 'project-generated')
    fs.writeFileSync(path.join(userSkill, 'SKILL.md'), 'user-owned')

    await installSkills('github', 'github', { forceOverwrite: true })

    // Project-generated ob- skills are preserved (not shipped, so not managed by update).
    expect(fs.readFileSync(path.join(projectSkill, 'SKILL.md'), 'utf-8')).toBe('project-generated')
    expect(fs.readFileSync(path.join(userSkill, 'SKILL.md'), 'utf-8')).toBe('user-owned')
    // Shipped skills are installed fresh.
    expect(fs.existsSync(path.join(skillsDir, 'ob-plan-goal', 'SKILL.md'))).toBe(true)
  })
})

describe('ops command patching (real presets + real templates)', () => {
  async function patchedCommand(name) {
    const p = path.join(tmpDir, '.opencode', 'commands', name)
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null
  }

  async function patchedSkill(name) {
    const p = path.join(tmpDir, '.agents', 'skills', name, 'SKILL.md')
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null
  }

  it.each([
    ['azure', 'gitlab'],
    ['jira', 'github'],
    ['browser', 'azure'],
    ['github', 'gitlab'],
  ])('backlog=%s repo=%s patches all ops targets', async (backlog, repo) => {
    // review/backlog stay commands; ship's procedure lives in the ob-ops-ship skill
    fs.mkdirSync(path.join(tmpDir, '.opencode', 'commands'), { recursive: true })
    for (const cmd of ['ops-review.md', 'ops-backlog.md']) {
      const src = path.join(CONTENT_DIR, '.opencode', 'commands', cmd)
      fs.copyFileSync(src, path.join(tmpDir, '.opencode', 'commands', cmd))
    }
    for (const skill of ['ob-ops-ship', 'ob-ops-evidence']) {
      fs.mkdirSync(path.join(tmpDir, '.agents', 'skills', skill), { recursive: true })
      fs.copyFileSync(
        path.join(CONTENT_DIR, '.agents', 'skills', skill, 'SKILL.md'),
        path.join(tmpDir, '.agents', 'skills', skill, 'SKILL.md'),
      )
    }

    await patchOpsShip({ backlogPlatform: backlog, repoPlatform: repo }, tmpDir)
    await patchOpsReview({ backlogPlatform: backlog, repoPlatform: repo }, tmpDir)
    await patchOpsBacklog({ backlogPlatform: backlog, repoPlatform: repo }, tmpDir)
    await patchOpsEvidence({ backlogPlatform: backlog, repoPlatform: repo }, tmpDir)

    const ship = await patchedSkill('ob-ops-ship')
    const review = await patchedCommand('ops-review.md')
    const backlogCmd = await patchedCommand('ops-backlog.md')
    const evidence = await patchedSkill('ob-ops-evidence')

    // Markers must survive
    expect(ship).toContain('OB-PLATFORM-SHIP-START')
    expect(ship).toContain('OB-PLATFORM-SHIP-END')
    expect(review).toContain('OB-PLATFORM-REVIEW-START')
    expect(review).toContain('OB-PLATFORM-REVIEW-END')
    expect(backlogCmd).toContain('OB-PLATFORM-BACKLOG-START')
    expect(backlogCmd).toContain('OB-PLATFORM-BACKLOG-END')
    expect(evidence).toContain('OB-PLATFORM-EVIDENCE-START')
    expect(evidence).toContain('OB-PLATFORM-EVIDENCE-END')
    // Evidence targets the backlog platform; browser has no CLI so nothing is
    // injected (markers stay adjacent), while gh/az/jira inject a comment step.
    // Normalize line endings for cross-platform test compatibility.
    const evidenceNormalized = evidence.replace(/\r\n/g, '\n')
    if (backlog === 'browser') {
      expect(evidenceNormalized).toContain('OB-PLATFORM-EVIDENCE-START -->\n<!-- OB-PLATFORM-EVIDENCE-END')
    } else {
      expect(evidenceNormalized).not.toContain('OB-PLATFORM-EVIDENCE-START -->\n<!-- OB-PLATFORM-EVIDENCE-END')
    }
    const evidenceCli = { github: 'issues/{number}/comments', azure: 'az boards work-item update', jira: 'acli jira issue comment' }
    if (evidenceCli[backlog]) {
      expect(evidence).toContain(evidenceCli[backlog])
      expect(evidence).toContain('commit-pinned')
    }
  })
})

describe('resolvePlatform accepts every platforms.json value', () => {
  it.each(['github', 'azure', 'jira', 'gitlab', 'browser', 'none'])('keeps %s', value => {
    expect(resolvePlatform(value)).toBe(value)
  })

  it('falls back to github for unknown/missing values', () => {
    expect(resolvePlatform('bitbucket')).toBe('github')
    expect(resolvePlatform(undefined)).toBe('github')
  })
})
