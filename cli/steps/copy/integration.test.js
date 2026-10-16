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
import { installSkills, removeRetiredFiles } from './skills.js'
import { hashComparableFile } from '../../utils/update-manifest.js'
import { patchOpsShip, patchOpsReview, patchOpsBacklog } from './commands.js'
import { resolvePlatform } from '../../commands/single.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTENT_DIR = path.resolve(__dirname, '../../../harness')
const SOURCE_SKILLS_DIR = path.resolve(__dirname, '../../../skills')
const REAL_AGENTS_MD = fs.readFileSync(path.join(CONTENT_DIR, 'AGENTS.md'), 'utf-8')
const REAL_OB_INIT_MD = fs.readFileSync(path.join(SOURCE_SKILLS_DIR, 'pc-repo-initialize', 'SKILL.md'), 'utf-8')

let tmpDir

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onboard-integration-'))
  vi.spyOn(process, 'cwd').mockReturnValue(tmpDir)
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

describe('patchAgentsMd against the real pc-repo-initialize SKILL.md', () => {
  const initPath = () => path.join(tmpDir, '.agents', 'skills', 'pc-repo-initialize', 'SKILL.md')

  function installInit() {
    fs.mkdirSync(path.join(tmpDir, '.agents', 'skills', 'pc-repo-initialize'), { recursive: true })
    fs.writeFileSync(initPath(), REAL_OB_INIT_MD)
  }

  it('leaves the file untouched when nothing exists yet', async () => {
    installInit()
    await patchAgentsMd({})
    expect(fs.readFileSync(initPath(), 'utf-8')).toBe(REAL_OB_INIT_MD)
  })

  // Every one of these titles has to match a heading in the shipped skill. The
  // patcher looked for a `Step N,` prefix the skill stopped using and a step
  // called "Chain make commands" that no longer existed, so both skips were
  // dead: a project with its own openspec/ history got told to archive it
  // again, and the only symptom was a warning during onboarding.
  it.each([
    ['hasOpenspec', 'Archive project history', 'already had an openspec/ history'],
    ['hasArchitecture', 'Generate ARCHITECTURE.md', 'ARCHITECTURE.md already exists'],
    ['hasDesign', 'Generate DESIGN.md', 'DESIGN.md already exists'],
  ])('marks the %s step as skipped', async (flag, title, note) => {
    installInit()

    await patchAgentsMd({ [flag]: true })

    const patched = fs.readFileSync(initPath(), 'utf-8')
    expect(patched).not.toBe(REAL_OB_INIT_MD)
    expect(patched).toContain(note)
    expect(patched).toContain(title)
  })

  // The block scan used to run to end of file when it found no `---`, so a
  // matched step took every step after it with it.
  it('keeps every later step when it skips one', async () => {
    installInit()

    await patchAgentsMd({ hasOpenspec: true })

    const patched = fs.readFileSync(initPath(), 'utf-8')
    for (const later of ['Generate ARCHITECTURE.md', 'Generate DESIGN.md', 'Generate guardrails', 'Show help', 'Initialization complete.']) {
      expect(patched).toContain(later)
    }
    // And the skipped step keeps nothing but the note.
    expect(patched).not.toContain('openspec new change "project-history"')
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
      'PC-PLATFORM-WORKFLOW-START', 'PC-PLATFORM-WORKFLOW-END',
      'PC-PLATFORM-SKILLS-GUIDE-START', 'PC-PLATFORM-SKILLS-GUIDE-END',
    ]) {
      expect(patched).toContain(marker)
    }
  })
})

describe('installSkills platform gating (real content/skills)', () => {
  async function installedSkill(name) {
    const p = path.join(tmpDir, '.agents', 'skills', name, 'SKILL.md')
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null
  }

  it('azure backlog + gitlab repo: azure userstory, gitlab ops commands', async () => {
    await installSkills('azure', 'gitlab')
    expect(await installedSkill('pc-userstory')).toContain('az boards work-item show')
    expect(await installedSkill('pc-ship')).toBeNull()
    expect(await installedSkill('pc-review')).toBeNull()
    expect(await installedSkill('pc-backlog')).toBeNull()
  })

  it('jira backlog + github repo: jira userstory, github ops commands', async () => {
    await installSkills('jira', 'github')
    expect(await installedSkill('pc-userstory')).toContain('acli jira workitem view')
    expect(await installedSkill('pc-ship')).toBeNull()
    expect(await installedSkill('pc-review')).toBeNull()
    expect(await installedSkill('pc-backlog')).toBeNull()
  })

  it('github backlog + none repo: github userstory, NO ops skills', async () => {
    await installSkills('github', 'none')
    expect(await installedSkill('pc-userstory')).toContain('gh issue view')
    expect(await installedSkill('pc-ship')).toBeNull()
    expect(await installedSkill('pc-review')).toBeNull()
    expect(await installedSkill('pc-backlog')).toBeNull()
  })

  it('browser backlog + azure repo: browser userstory, NO ops skills', async () => {
    await installSkills('browser', 'azure')
    expect(await installedSkill('pc-userstory')).toContain('agent-browser --session backlog --restore open')
    expect(await installedSkill('pc-ship')).toBeNull()
    expect(await installedSkill('pc-review')).toBeNull()
    expect(await installedSkill('pc-backlog')).toBeNull()
  })

  it('update mode replaces shipped ob skills and preserves project-generated skills', async () => {
    const skillsDir = path.join(tmpDir, '.agents', 'skills')
    // A project-generated skill (not shipped by agent-harness): must survive update.
    const projectSkill = path.join(skillsDir, 'pc-merge-risk-assess')
    // A non-ob user skill: must survive update.
    const userSkill = path.join(skillsDir, 'project-workflow')
    fs.mkdirSync(projectSkill, { recursive: true })
    fs.mkdirSync(userSkill, { recursive: true })
    fs.writeFileSync(path.join(projectSkill, 'SKILL.md'), 'project-generated')
    fs.writeFileSync(path.join(userSkill, 'SKILL.md'), 'user-owned')

    await installSkills('github', 'github', { forceOverwrite: true })

    // Project-generated pc- skills are preserved (not shipped, so not managed by update).
    expect(fs.readFileSync(path.join(projectSkill, 'SKILL.md'), 'utf-8')).toBe('project-generated')
    expect(fs.readFileSync(path.join(userSkill, 'SKILL.md'), 'utf-8')).toBe('user-owned')
    // Shipped skills are installed fresh.
    expect(fs.existsSync(path.join(skillsDir, 'pc-plan-goal', 'SKILL.md'))).toBe(true)
  })

  // pc-make-merge-risk-assess is a plain shipped skill, not a marker skill, so
  // it took the syncSkillFiles path: a project that edited its example lost
  // every later harness update to that file. The file's own prose promises the
  // opposite — the slot is the project's, the rest is the harness's.
  it('update mode keeps a project example and still refreshes the file around it', async () => {
    const referencePath = path.join(
      tmpDir, '.agents', 'skills', 'pc-make-merge-risk-assess', 'category-reference.md')
    fs.mkdirSync(path.dirname(referencePath), { recursive: true })
    fs.writeFileSync(referencePath, [
      '# Stale heading a previous version shipped',
      '',
      '<!-- PC-PROJECT-EXAMPLE-START -->',
      '### Calculation Integrity',
      '- Any change under `src/billing/` needs a golden vector.',
      '<!-- PC-PROJECT-EXAMPLE-END -->',
    ].join('\n'))

    await installSkills('github', 'github', { updateMode: true })

    const merged = fs.readFileSync(referencePath, 'utf-8')
    // The project's own example survives.
    expect(merged).toContain('src/billing/')
    // And the harness prose around it is now current.
    expect(merged).toMatch(/at most 40 indicators/i)
    expect(merged).not.toContain('Stale heading a previous version shipped')
  })

  it('update mode preserves generated guardrails even though the skill is shipped', async () => {
    const skillsDir = path.join(tmpDir, '.agents', 'skills')
    // pc-guardrails-project is a shipped skill with a placeholder, but after
    // /make-guardrails runs, it has project-specific content with a timestamp.
    const guardrailsDir = path.join(skillsDir, 'pc-guardrails-project')
    fs.mkdirSync(guardrailsDir, { recursive: true })
    fs.writeFileSync(path.join(guardrailsDir, 'SKILL.md'), '# Project Guardrails\n\n- Rule 1\n\n<!-- Last updated: 2026-07-28T12:00:00Z -->')

    await installSkills('github', 'github', { forceOverwrite: true })

    // The generated guardrails content must survive — not replaced by the placeholder.
    const content = fs.readFileSync(path.join(guardrailsDir, 'SKILL.md'), 'utf-8')
    expect(content).toContain('Rule 1')
    expect(content).toContain('Last updated: 2026-07-28')
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
    // review/backlog stay commands; ship's procedure lives in the pc-ops-ship skill
    fs.mkdirSync(path.join(tmpDir, '.opencode', 'commands'), { recursive: true })
    for (const cmd of ['ops-review.md', 'ops-backlog.md']) {
      const src = path.join(CONTENT_DIR, '.opencode', 'commands', cmd)
      fs.copyFileSync(src, path.join(tmpDir, '.opencode', 'commands', cmd))
    }
    for (const skill of ['pc-ops-ship']) {
      fs.mkdirSync(path.join(tmpDir, '.agents', 'skills', skill), { recursive: true })
      fs.copyFileSync(
        path.join(SOURCE_SKILLS_DIR, skill, 'SKILL.md'),
        path.join(tmpDir, '.agents', 'skills', skill, 'SKILL.md'),
      )
    }

    await patchOpsShip({ backlogPlatform: backlog, repoPlatform: repo }, tmpDir)
    await patchOpsReview({ backlogPlatform: backlog, repoPlatform: repo }, tmpDir)
    await patchOpsBacklog({ backlogPlatform: backlog, repoPlatform: repo }, tmpDir)

    const ship = await patchedSkill('pc-ops-ship')
    const review = await patchedCommand('ops-review.md')
    const backlogCmd = await patchedCommand('ops-backlog.md')

    // Markers must survive
    expect(ship).toContain('PC-PLATFORM-SHIP-START')
    expect(ship).toContain('PC-PLATFORM-SHIP-END')
    expect(review).toContain('PC-PLATFORM-REVIEW-START')
    expect(review).toContain('PC-PLATFORM-REVIEW-END')
    expect(backlogCmd).toContain('PC-PLATFORM-BACKLOG-START')
    expect(backlogCmd).toContain('PC-PLATFORM-BACKLOG-END')
  })
})

// Marker skills used to be preserved wholesale on update, which froze their
// prose at whatever version a consumer first installed. A skill rewrite then
// only ever reached fresh installs.
describe('update refreshes marker skills but keeps project-owned content', () => {
  const shipped = name =>
    fs.readFileSync(path.join(SOURCE_SKILLS_DIR, name, 'SKILL.md'), 'utf-8')

  const installed = name =>
    fs.readFileSync(path.join(tmpDir, '.agents', 'skills', name, 'SKILL.md'), 'utf-8')

  function seed(name, body) {
    fs.mkdirSync(path.join(tmpDir, '.agents', 'skills', name), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, '.agents', 'skills', name, 'SKILL.md'), body)
  }

  it('replaces stale prose in a marker skill', async () => {
    seed('pc-ops-ship', '---\nname: pc-ops-ship\n---\n\nAncient prose from an old release.\n')

    await installSkills('github', 'github', { updateMode: true })

    expect(installed('pc-ops-ship')).not.toContain('Ancient prose')
    // The platform body is injected separately, so the refreshed file still
    // carries the empty marker pair for patchOpsShip to fill.
    expect(installed('pc-ops-ship')).toContain('PC-PLATFORM-SHIP-START')
  })

  it('carries a PC-PROJECT slot over the refresh', async () => {
    const adapted = shipped('pc-repo-verify').replace(
      /<!-- PC-PROJECT-ENVIRONMENT-START -->[\s\S]*?<!-- PC-PROJECT-ENVIRONMENT-END -->/,
      '<!-- PC-PROJECT-ENVIRONMENT-START -->\nSIGN IN AS ALICE ADMIN\n<!-- PC-PROJECT-ENVIRONMENT-END -->',
    )
    seed('pc-repo-verify', `${adapted}\nstale tail that must go\n`)

    await installSkills('github', 'github', { updateMode: true })

    expect(installed('pc-repo-verify')).toContain('SIGN IN AS ALICE ADMIN')
    expect(installed('pc-repo-verify')).not.toContain('stale tail that must go')
  })

  it('carries a PC-PROJECT slot when the manifest records the file as managed', async () => {
    const adapted = shipped('pc-repo-verify').replace(
      /<!-- PC-PROJECT-ENVIRONMENT-START -->[\s\S]*?<!-- PC-PROJECT-ENVIRONMENT-END -->/,
      '<!-- PC-PROJECT-ENVIRONMENT-START -->\nSIGN IN AS ALICE ADMIN\n<!-- PC-PROJECT-ENVIRONMENT-END -->',
    )
    seed('pc-repo-verify', adapted)
    const relative = '.agents/skills/pc-repo-verify/SKILL.md'
    fs.mkdirSync(path.join(tmpDir, '.opencode'), { recursive: true })
    fs.writeFileSync(
      path.join(tmpDir, '.opencode', 'harness-managed.json'),
      JSON.stringify({ version: 1, files: { [relative]: await hashComparableFile(path.join(tmpDir, relative)) } }),
    )

    await installSkills('github', 'github', { updateMode: true })

    expect(installed('pc-repo-verify')).toContain('SIGN IN AS ALICE ADMIN')
  })

  it('removes the retired evidence skills and commands', async () => {
    const retired = [
      '.agents/skills/pc-ops-evidence/SKILL.md',
      '.agents/skills/pc-make-evidence-scaffold/SKILL.md',
      '.opencode/commands/ops-evidence.md',
    ]
    for (const relative of retired) {
      fs.mkdirSync(path.dirname(path.join(tmpDir, relative)), { recursive: true })
      fs.writeFileSync(path.join(tmpDir, relative), 'retired\n')
    }

    await removeRetiredFiles(tmpDir)

    expect(fs.existsSync(path.join(tmpDir, '.agents', 'skills', 'pc-ops-evidence'))).toBe(false)
    expect(fs.existsSync(path.join(tmpDir, '.agents', 'skills', 'pc-make-evidence-scaffold'))).toBe(false)
    expect(fs.existsSync(path.join(tmpDir, '.opencode', 'commands', 'ops-evidence.md'))).toBe(false)
  })

  it('never refreshes a generated skill', async () => {
    seed('pc-guardrails-project', '<!-- Last updated: 2026-01-01 -->\nNever import across contexts.\n')

    await installSkills('github', 'github', { updateMode: true })

    expect(installed('pc-guardrails-project')).toContain('Never import across contexts.')
  })

  // patchAgentsMd stamps "skipped during onboarding" notes into this one on a
  // fresh install only, so a refresh would discard them.
  it('never refreshes pc-repo-initialize', async () => {
    seed('pc-repo-initialize', 'Step 3 skipped during onboarding: openspec/ already existed.\n')

    await installSkills('github', 'github', { updateMode: true })

    expect(installed('pc-repo-initialize')).toContain('skipped during onboarding')
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
