// ob-subagent-tiers: on startup, reads *-engineer.md templates and creates
// tier variant files with the resolved model. Variants are gitignored and
// regenerated every startup. Model resolution: user override > team config.

import fs from "node:fs/promises"
import path from "node:path"

const TIERS = ["build", "fast", "plan"]

export const ObSubagentTiers = async ({ directory }) => {
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
      readJson(path.join(root, ".opencode", "opencode-onboard.user.json")),
      readJson(path.join(root, ".opencode", "opencode-onboard.json")),
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
        templates: entries.filter(f => /^[\w-]+-engineer\.md$/.test(f) && f !== 'fullstack-engineer.md').map(f => f.replace(/\.md$/, "")),
        variantFiles: entries.filter(f => /^[\w-]+-engineer\.(build|fast|plan)\.md$/.test(f)),
      }
    } catch {
      return { templates: [], variantFiles: [] }
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

  // Ensure template files have mode: primary and no stale model: line. Base
  // engineer templates must never declare a model: models are resolved at
  // startup per-tier and injected into variant files only. A stale model:
  // (e.g. from a prior `stampAgentModels` run) is stripped here so the base
  // agent falls back to the session-level model in opencode.jsonc.
  function normalizeTemplate(templateContent) {
    const fmMatch = templateContent.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!fmMatch) return templateContent

    let fm = fmMatch[1]
    let changed = false

    if (!/^mode:\s*primary/m.test(fm)) {
      fm = /^mode:/m.test(fm) ? fm.replace(/^mode:.*$/m, 'mode: primary') : `mode: primary\n${fm}`
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
        const { templates, variantFiles } = await scanEngineers()

        const templateContents = await Promise.all(
          templates.map(async name => {
            const rawContent = await fs.readFile(path.join(agentsDir, `${name}.md`), "utf-8")
            const content = normalizeTemplate(rawContent)
            // If the template had the wrong mode or a stale model:, persist the fix to disk
            if (content !== rawContent) {
              await writeIfChanged(path.join(agentsDir, `${name}.md`), content)
              console.error(`[ob-subagent-tiers] Normalized ${name}.md (mode: primary, model: removed)`)
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
          // Ensure base templates are always mode: primary in-memory
          for (const { name } of templateContents) {
            if (cfg.agent[name]) {
              cfg.agent[name].mode = 'primary'
            }
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
          console.error(`[ob-subagent-tiers] Created ${variantsToWrite.length} variant files (${templates.length} engineers x ${available.length} tiers)`)
        } else if (templates.length > 0) {
          console.error(`[ob-subagent-tiers] No variants created. Models: ${JSON.stringify(models)}`)
        }
      } catch (err) {
        console.error(`[ob-subagent-tiers] Error: ${err.message}`)
      }
    },
  }
}
