import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fse from 'fs-extra'
import os from 'node:os'
import path from 'node:path'

vi.mock('execa', () => ({
  // Pretend the tree is clean; the dirty path is exercised separately.
  execa: vi.fn(async () => ({ exitCode: 0, stdout: '' })),
}))

const { execa } = await import('execa')
const { planMigration, runMigrate } = await import('./migrate.js')

let cwd

// Mirrors what Numa and Odissey actually hold: shipped ob-* skills, two
// generated ones with real content, third-party skills, custom engineers with
// stale tier variants, and a manifest keyed by old paths.
async function seedV1Project(root) {
  const oc = path.join(root, '.opencode')
  const skills = path.join(root, '.agents', 'skills')

  await fse.outputJson(path.join(oc, 'opencode-onboard.json'), {
    version: 2,
    platform: { backlog: 'github', repo: 'github' },
    models: { plan: 'p/plan', build: 'p/build', fast: 'p/fast' },
  })
  await fse.outputJson(path.join(oc, 'opencode-onboard-managed.json'), {
    version: 1,
    files: {
      '.agents/skills/ob-plan-apply/SKILL.md': 'hash-a',
      '.opencode/commands/plan-apply.md': 'hash-b',
    },
  })
  await fse.outputFile(path.join(oc, '.ob-run.json'), '{"agents":{}}')

  await fse.outputFile(
    path.join(oc, 'commands', 'plan-apply.md'),
    'Load the `ob-plan-apply` skill.\n',
  )

  // Shipped: replaced by update.
  for (const name of ['ob-plan-apply', 'ob-repo-help', 'ob-userstory']) {
    await fse.outputFile(path.join(skills, name, 'SKILL.md'), `shipped ${name}\n`)
  }
  // Generated: irreplaceable, must survive with content intact.
  await fse.outputFile(
    path.join(skills, 'ob-guardrails-project', 'SKILL.md'),
    '<!-- Last updated: 2026-01-01 -->\nProject rule: never commit to main.\nSee `ob-plan-apply`.\n',
  )
  await fse.outputFile(
    path.join(skills, 'ob-merge-risk-assess', 'SKILL.md'),
    'Risk: the payments module is load bearing.\n',
  )
  // Project-generated, not shipped at all.
  await fse.outputFile(path.join(skills, 'ob-custom-loop', 'SKILL.md'), 'Our own loop.\n')
  // Third-party: must not be touched.
  await fse.outputFile(path.join(skills, 'clean-ddd-hexagonal', 'SKILL.md'), 'third party\n')

  await fse.outputFile(
    path.join(oc, 'agents', 'backend-engineer.md'),
    '---\ndescription: Backend.\nmode: primary\n---\n\nYou are a backend engineer.\n\n## Abilities\n- Guardrails: @ob-guardrails-generic, @ob-guardrails-project\n',
  )
  for (const tier of ['build', 'fast', 'plan']) {
    await fse.outputFile(path.join(oc, 'agents', `backend-engineer.${tier}.md`), 'stale variant\n')
  }
  await fse.outputFile(
    path.join(oc, 'agents', 'fullstack-engineer.md'),
    '---\ndescription: Default.\nmode: primary\n---\n\nDefault engineer.\n\n## Abilities\n- Guardrails: @ob-guardrails-generic\n',
  )

  await fse.outputFile(
    path.join(root, 'AGENTS.md'),
    'Read `.opencode/opencode-onboard.json` before spawning.\n<!-- OB-PLATFORM-WORKFLOW-START -->\n<!-- OB-PLATFORM-WORKFLOW-END -->\n',
  )
  // The one string a naive ob- replace corrupts.
  await fse.outputFile(path.join(oc, 'commands', 'ops-ship.md'), 'gh pr comment --body ({blob-url})\n')

  // An archived change is history; a live spec is current documentation.
  await fse.outputFile(
    path.join(root, 'openspec', 'changes', 'archive', '2026-01-01-thing', 'proposal.md'),
    'Guardrails checked: `@ob-guardrails-project`.\n',
  )
  await fse.outputFile(
    path.join(root, 'openspec', 'specs', 'infra', 'spec.md'),
    'Applies the `ob-repo-verify` gate.\n',
  )
}

const read = (...p) => fse.readFile(path.join(cwd, ...p), 'utf-8')
const exists = (...p) => fse.pathExists(path.join(cwd, ...p))

beforeEach(async () => {
  cwd = await fse.mkdtemp(path.join(os.tmpdir(), 'pc-migrate-'))
  await seedV1Project(cwd)
  execa.mockClear()
})

afterEach(async () => {
  await fse.remove(cwd)
})

describe('runMigrate() content preservation', () => {
  it('keeps generated skills with their content, under the new name', async () => {
    await runMigrate({ cwd })

    expect(await exists('.agents', 'skills', 'ob-guardrails-project')).toBe(false)
    const guardrails = await read('.agents', 'skills', 'pc-guardrails-project', 'SKILL.md')
    expect(guardrails).toContain('never commit to main')
    // References inside preserved content are rewritten too.
    expect(guardrails).toContain('pc-plan-apply')
    expect(guardrails).not.toContain('ob-plan-apply')

    const risk = await read('.agents', 'skills', 'pc-merge-risk-assess', 'SKILL.md')
    expect(risk).toContain('payments module is load bearing')
  })

  it('keeps project-generated skills that never shipped', async () => {
    await runMigrate({ cwd })

    expect(await read('.agents', 'skills', 'pc-custom-loop', 'SKILL.md')).toContain('Our own loop.')
  })

  it('leaves third-party skills alone', async () => {
    await runMigrate({ cwd })

    expect(await read('.agents', 'skills', 'clean-ddd-hexagonal', 'SKILL.md')).toContain('third party')
  })

  it('keeps custom engineers and rewrites their ability references', async () => {
    await runMigrate({ cwd })

    const backend = await read('.opencode', 'agents', 'backend-engineer.md')
    expect(backend).toContain('You are a backend engineer.')
    expect(backend).toContain('@pc-guardrails-project')
    expect(backend).not.toContain('@ob-')
    expect(backend).toContain('mode: subagent')
  })

  it('drops shipped skills so update reinstalls them', async () => {
    await runMigrate({ cwd })

    for (const name of ['ob-plan-apply', 'ob-repo-help', 'ob-userstory']) {
      expect(await exists('.agents', 'skills', name)).toBe(false)
    }
    // ...and does not leave a half-renamed copy behind either.
    expect(await exists('.agents', 'skills', 'pc-plan-apply')).toBe(false)
  })
})

describe('runMigrate() state and identifiers', () => {
  it('renames the state files', async () => {
    await runMigrate({ cwd })

    expect(await exists('.opencode', 'harness.json')).toBe(true)
    expect(await exists('.opencode', 'opencode-onboard.json')).toBe(false)
    expect(await exists('.opencode', 'harness-managed.json')).toBe(true)
    expect(await exists('.opencode', '.ob-run.json')).toBe(false)
  })

  it('preserves config contents through the rename', async () => {
    await runMigrate({ cwd })

    const cfg = await fse.readJson(path.join(cwd, '.opencode', 'harness.json'))
    expect(cfg.models.build).toBe('p/build')
    expect(cfg.platform.backlog).toBe('github')
  })

  // Without this, update sees the renamed skills as hand-modified and keeps v1
  // content forever under the new names.
  it('rewrites manifest keys while keeping their hashes', async () => {
    await runMigrate({ cwd })

    const manifest = await fse.readJson(path.join(cwd, '.opencode', 'harness-managed.json'))
    expect(manifest.files['.agents/skills/pc-plan-apply/SKILL.md']).toBe('hash-a')
    expect(manifest.files['.agents/skills/ob-plan-apply/SKILL.md']).toBeUndefined()
  })

  it('rewrites uppercase platform markers', async () => {
    await runMigrate({ cwd })

    const agents = await read('AGENTS.md')
    expect(agents).toContain('<!-- PC-PLATFORM-WORKFLOW-START -->')
    expect(agents).toContain('.opencode/harness.json')
    expect(agents).not.toContain('OB-PLATFORM')
  })

  // Those proposals really did reference ob-* when they were written; rewriting
  // them would make the audit trail say something that was never true.
  it('leaves archived openspec changes verbatim', async () => {
    await runMigrate({ cwd })

    const archived = await read('openspec', 'changes', 'archive', '2026-01-01-thing', 'proposal.md')
    expect(archived).toContain('@ob-guardrails-project')
    expect(archived).not.toContain('@pc-guardrails-project')
  })

  it('does rewrite live openspec specs', async () => {
    await runMigrate({ cwd })

    expect(await read('openspec', 'specs', 'infra', 'spec.md')).toContain('pc-repo-verify')
  })

  it('does not corrupt {blob-url}', async () => {
    await runMigrate({ cwd })

    expect(await read('.opencode', 'commands', 'ops-ship.md')).toContain('{blob-url}')
  })

  it('removes stale tier variants for the plugin to rebuild', async () => {
    await runMigrate({ cwd })

    for (const tier of ['build', 'fast', 'plan']) {
      expect(await exists('.opencode', 'agents', `backend-engineer.${tier}.md`)).toBe(false)
    }
    expect(await exists('.opencode', 'agents', 'backend-engineer.md')).toBe(true)
  })

  it('demotes fullstack to subagent', async () => {
    await runMigrate({ cwd })

    expect(await read('.opencode', 'agents', 'fullstack-engineer.md')).toContain('mode: subagent')
  })
})

describe('runMigrate() guards', () => {
  it('is a no-op on a project already on v2', async () => {
    await fse.outputJson(path.join(cwd, '.opencode', 'harness.json'), { version: 2 })

    const result = await runMigrate({ cwd })
    expect(result).toMatchObject({ migrated: false, alreadyV2: true })
    // The v1 file is left exactly as it was rather than half-migrated.
    expect(await exists('.opencode', 'opencode-onboard.json')).toBe(true)
  })

  it('does nothing when there is no v1 config', async () => {
    await fse.remove(path.join(cwd, '.opencode', 'opencode-onboard.json'))

    expect(await runMigrate({ cwd })).toMatchObject({ migrated: false })
  })

  it('refuses a dirty tree so the change stays revertible', async () => {
    execa.mockResolvedValueOnce({ exitCode: 0, stdout: ' M src/thing.ts' })

    const result = await runMigrate({ cwd })
    expect(result).toMatchObject({ migrated: false, dirty: true })
    expect(await exists('.opencode', 'opencode-onboard.json')).toBe(true)
  })

  it('proceeds on a dirty tree with force', async () => {
    execa.mockResolvedValueOnce({ exitCode: 0, stdout: ' M src/thing.ts' })

    expect(await runMigrate({ cwd, force: true })).toMatchObject({ migrated: true })
  })

  it('writes nothing on a dry run', async () => {
    const result = await runMigrate({ cwd, dryRun: true })

    expect(result).toMatchObject({ migrated: false, dryRun: true })
    expect(await exists('.opencode', 'opencode-onboard.json')).toBe(true)
    expect(await exists('.agents', 'skills', 'ob-guardrails-project')).toBe(true)
  })
})

describe('planMigration()', () => {
  it('separates what is kept from what is replaced', async () => {
    const plan = await planMigration(cwd)

    const renamed = plan.skillsToRename.map(([from]) => from).sort()
    expect(renamed).toEqual(['ob-custom-loop', 'ob-guardrails-project', 'ob-merge-risk-assess'])
    expect(plan.skillsToDrop.sort()).toEqual(['ob-plan-apply', 'ob-repo-help', 'ob-userstory'])
    expect(plan.staleVariants).toHaveLength(3)
  })
})
