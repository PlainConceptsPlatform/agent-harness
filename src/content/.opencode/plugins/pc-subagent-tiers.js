// pc-subagent-tiers: on startup, reads *-engineer.md templates and creates
// tier variant files with the resolved model, plus the two primary agents the
// user actually talks to. Everything generated here is gitignored and rebuilt
// every startup. Model resolution: user override > team config.
//
// Agent topology:
//   build.md / plan.md      mode: primary   the only agents a human selects.
//                                           Both are fullstack-engineer with a
//                                           tier model; plan cannot edit.
//   fullstack-engineer.md   mode: subagent  the shared body of build and plan,
//                                           and the fallback worker.
//   *-engineer.md           mode: subagent  specialists, spawned by task().
//   *-engineer.<tier>.md    mode: subagent  the same specialist pinned to a tier.
//
// Overriding opencode's built-in build and plan (rather than disabling them, as
// earlier versions did) means the agent picker offers exactly two entries and
// both carry our prompt and abilities.

import fs from "node:fs/promises"
import path from "node:path"

const TIERS = ["build", "fast", "plan"]

// The two primaries, and the tier each takes its model from. plan denies edit
// so a planning session cannot mutate the tree; bash stays allowed because the
// planning skills shell out to git and openspec to read state.
const PRIMARIES = {
  build: {
    tier: "build",
    description: "Implement changes in this repository. Full write access, spawns specialist engineers for parallel work.",
    permission: null,
  },
  plan: {
    tier: "plan",
    description: "Explore and plan without touching the tree. Read-only: proposes work for build to carry out.",
    permission: { edit: "deny" },
  },
}

const FULLSTACK_NAME = "fullstack-engineer"
const FULLSTACK_TEMPLATE = `${FULLSTACK_NAME}.md`

export const PcSubagentTiers = async ({ directory }) => {
  const root = directory || process.cwd()
  const agentsDir = path.join(root, ".opencode", "agents")

  async function readJson(filePath) {
    try {
      return JSON.parse(await fs.readFile(filePath, "utf-8"))
    } catch {
      return null
    }
  }

  async function resolveModels() {
    const [user, team] = await Promise.all([
      readJson(path.join(root, ".opencode", "harness.user.json")),
      readJson(path.join(root, ".opencode", "harness.json")),
    ])
    const models = {}
    for (const tier of TIERS) {
      models[tier] = user?.models?.[tier] ?? team?.models?.[tier] ?? null
    }
    return models
  }

  async function scanEngineers() {
    try {
      const entries = await fs.readdir(agentsDir)
      return {
        templates: entries.filter(f => /^[\w-]+-engineer\.md$/.test(f) && f !== FULLSTACK_TEMPLATE).map(f => f.replace(/\.md$/, "")),
        variantFiles: entries.filter(f => /^[\w-]+-engineer\.(build|fast|plan)\.md$/.test(f)),
        hasFullstack: entries.includes(FULLSTACK_TEMPLATE),
      }
    } catch {
      return { templates: [], variantFiles: [], hasFullstack: false }
    }
  }

  function variantFile(name, tier) {
    return `${name}.${tier}.md`
  }

  function buildVariant(templateContent, model) {
    const fmMatch = templateContent.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    const modelLine = `model: ${model}`
    if (!fmMatch) return `---\nmode: subagent\n${modelLine}\n---\n\n${templateContent}`

    let fm = fmMatch[1]
    fm = /^mode:/m.test(fm) ? fm.replace(/^mode:.*$/m, 'mode: subagent') : `mode: subagent\n${fm}`
    fm = /^model:/m.test(fm) ? fm.replace(/^model:.*$/m, modelLine) : `${modelLine}\n${fm}`

    // Slice at frontmatter end: never String.replace with content-derived
    // strings, it matches the wrong occurrence and expands $& sequences.
    return `---\n${fm}\n---${templateContent.slice(fmMatch[0].length)}`
  }

  // Ensure template files are mode: subagent with no stale model: line. Only
  // build and plan are primary; every engineer is reached through task(), never
  // picked by a human, so a primary engineer would just clutter the picker.
  // Templates must never declare a model either: models resolve per tier at
  // startup and are injected into generated files only, so a stale model: (from
  // a prior `stampAgentModels` run, or from when these were primary) is
  // stripped and the agent falls back to the session model in opencode.jsonc.
  function normalizeTemplate(templateContent) {
    const fmMatch = templateContent.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!fmMatch) return templateContent

    let fm = fmMatch[1]
    let changed = false

    if (!/^mode:\s*subagent/m.test(fm)) {
      fm = /^mode:/m.test(fm) ? fm.replace(/^mode:.*$/m, 'mode: subagent') : `mode: subagent\n${fm}`
      changed = true
    }
    if (/^model:/m.test(fm)) {
      // Remove the model: line and its trailing newline without leaving a
      // leading blank line (model: can be the first frontmatter entry).
      fm = fm.replace(/^model:[^\n]*\r?\n?/m, '').replace(/^\r?\n/, '').replace(/\n$/, '')
      changed = true
    }

    return changed ? `---\n${fm}\n---${templateContent.slice(fmMatch[0].length)}` : templateContent
  }

  function descriptionOf(templateContent) {
    return templateContent.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? null
  }

  // Build a primary from the fullstack body: same identity and the same
  // ## Abilities block, with our own frontmatter on top. The body is taken
  // verbatim so /make-engineer only has to maintain fullstack-engineer.md and
  // both primaries inherit whatever it lists.
  function buildPrimary(name, spec, fullstackContent, model) {
    const body = fullstackContent.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim()

    const lines = [
      '---',
      `description: ${spec.description}`,
      'mode: primary',
    ]
    if (model) lines.push(`model: ${model}`)
    lines.push('color: warning')
    lines.push('permission:')
    // plan denies edit; everything else stays allowed so the planning skills can
    // still read the tree, shell out to git and openspec, and spawn engineers.
    lines.push(`  edit: ${spec.permission?.edit ?? 'allow'}`)
    for (const key of ['bash', 'read', 'glob', 'grep', 'question', 'todowrite', 'task', 'skill']) {
      lines.push(`  ${key}: ${spec.permission?.[key] ?? 'allow'}`)
    }
    lines.push('---')

    return `${lines.join('\n')}\n\n${body}\n`
  }

  // Skip writing if the file already has identical content.
  async function writeIfChanged(filePath, content) {
    try {
      if ((await fs.readFile(filePath, "utf-8")) === content) return
    } catch {
      // file missing, write it
    }
    const tmpPath = `${filePath}.tmp`
    await fs.writeFile(tmpPath, content, "utf-8")
    await fs.rename(tmpPath, filePath)
  }

  return {
    config: async (cfg) => {
      try {
        const models = await resolveModels()
        const available = TIERS.filter(t => models[t])
        const { templates, variantFiles, hasFullstack } = await scanEngineers()

        // build.md and plan.md are regenerated from fullstack-engineer.md every
        // startup, which is also how an edit to fullstack propagates to both.
        // normalizeTemplate runs on it too, so a repo carrying the old
        // mode: primary fullstack is migrated in place on first launch.
        if (hasFullstack) {
          const fullstackPath = path.join(agentsDir, FULLSTACK_TEMPLATE)
          const rawFullstack = await fs.readFile(fullstackPath, "utf-8")
          const fullstack = normalizeTemplate(rawFullstack)
          if (fullstack !== rawFullstack) {
            await writeIfChanged(fullstackPath, fullstack)
            console.error(`[pc-subagent-tiers] Normalized ${FULLSTACK_TEMPLATE} (mode: subagent)`)
          }

          for (const [name, spec] of Object.entries(PRIMARIES)) {
            const model = models[spec.tier]
            await writeIfChanged(
              path.join(agentsDir, `${name}.md`),
              buildPrimary(name, spec, fullstack, model),
            )
            if (cfg?.agent) {
              // Override opencode's built-in agent of the same name rather than
              // disabling it, so the picker shows ours with our model.
              cfg.agent[name] = {
                ...cfg.agent[name],
                mode: 'primary',
                description: spec.description,
                ...(model ? { model } : {}),
                ...(spec.permission ? { permission: { ...cfg.agent[name]?.permission, ...spec.permission } } : {}),
              }
            }
          }
          console.error(`[pc-subagent-tiers] Wrote primaries: build (${models.build ?? 'session model'}), plan (${models.plan ?? 'session model'})`)
        } else {
          console.error(`[pc-subagent-tiers] ${FULLSTACK_TEMPLATE} missing: build and plan not generated`)
        }

        const templateContents = await Promise.all(
          templates.map(async name => {
            const rawContent = await fs.readFile(path.join(agentsDir, `${name}.md`), "utf-8")
            const content = normalizeTemplate(rawContent)
            // If the template had the wrong mode or a stale model:, persist the fix to disk
            if (content !== rawContent) {
              await writeIfChanged(path.join(agentsDir, `${name}.md`), content)
              console.error(`[pc-subagent-tiers] Normalized ${name}.md (mode: subagent, model: removed)`)
            }
            return { name, content }
          })
        )

        const keepSet = new Set()
        const variantsToWrite = []

        for (const { name, content } of templateContents) {
          for (const tier of available) {
            const file = variantFile(name, tier)
            variantsToWrite.push({
              file,
              path: path.join(agentsDir, file),
              content: buildVariant(content, models[tier]),
              name,
              tier,
              templateContent: content,
            })
            keepSet.add(file)
          }
        }

        await Promise.all(variantsToWrite.map(v => writeIfChanged(v.path, v.content)))

        if (cfg?.agent) {
          // Ensure base templates are always mode: subagent in-memory. A repo
          // upgraded from an earlier version may still have primary in config.
          for (const { name } of templateContents) {
            if (cfg.agent[name]) {
              cfg.agent[name].mode = 'subagent'
            }
          }
          if (cfg.agent[FULLSTACK_NAME]) {
            cfg.agent[FULLSTACK_NAME].mode = 'subagent'
          }
          for (const { name, tier, templateContent } of variantsToWrite) {
            const base = cfg.agent[name]
            cfg.agent[`${name}.${tier}`] = base
              ? { ...base, mode: 'subagent', model: models[tier] }
              : {
                mode: "subagent",
                description: descriptionOf(templateContent) ?? `${name} (${tier} tier)`,
                model: models[tier],
              }
          }
        }

        await Promise.all(
          variantFiles.filter(f => !keepSet.has(f)).map(f => fs.unlink(path.join(agentsDir, f)).catch(() => {}))
        )

        if (variantsToWrite.length > 0) {
          console.error(`[pc-subagent-tiers] Created ${variantsToWrite.length} variant files (${templates.length} engineers x ${available.length} tiers)`)
        } else if (templates.length > 0) {
          console.error(`[pc-subagent-tiers] No variants created. Models: ${JSON.stringify(models)}`)
        }
      } catch (err) {
        console.error(`[pc-subagent-tiers] Error: ${err.message}`)
      }
    },
  }
}
