// pc-subagent-tiers: on startup, reads *-engineer.md templates and creates
// tier variant agent files with the resolved model, plus the two primary agents
// the user actually talks to. Everything generated here is gitignored and
// rebuilt every startup. Model resolution: user override > team config.
//
// Agent topology:
//   build.md / plan.md      mode: primary   the only agents a human selects.
//                                           Both are fullstack-engineer with a
//                                           tier model; plan can neither edit
//                                           nor spawn.
//   fullstack-engineer.md   mode: subagent  the shared body of build and plan,
//                                           and the fallback worker.
//   *-engineer.md           mode: subagent  specialists, spawned by subagent().
//   *-engineer.<tier>.md    mode: subagent  the same specialist pinned to a tier.
//
// OpenCode 2 discovers agents from .opencode/agents/*.md and overrides a built-in
// by ID, so the generated files replace the built-in build/plan. The plugin API's
// agent editor can update or remove an existing agent but cannot add one, so file
// generation is the mechanism: writing the files in setup, before agents resolve,
// is what makes them visible.

import { Plugin, Model } from "@opencode/plugin"
import fs from "node:fs/promises"
import path from "node:path"

const TIERS = ["build", "fast", "plan"]

// The two primaries, and the tier each takes its model from. plan denies edit
// and subagent: a planning session cannot mutate the tree itself, and it cannot
// spawn a worker that would do it on its behalf. shell stays allowed because the
// planning skills shell out to git and openspec to read state, and
// pc-system-reminders holds it to inspection commands.
const PRIMARIES = {
  build: {
    tier: "build",
    color: "primary",
    description: "Implement changes in this repository. Full write access, spawns specialist engineers for parallel work.",
    permissions: null,
  },
  plan: {
    tier: "plan",
    color: "warning",
    description: "Explore and plan without touching the tree. Read-only: proposes work for build to carry out.",
    permissions: [
      { action: "edit", resource: "*", effect: "deny" },
      { action: "subagent", resource: "*", effect: "deny" },
    ],
  },
}

// opencode's theme keywords. Treated as unset so a name-derived hex wins: the
// old /make-engineer template asked whoever ran it to pick one of these and
// avoid collisions by hand, which does not survive more than a few agents.
const THEME_COLORS = new Set(["primary", "secondary", "accent", "success", "warning", "error", "info"])

// Fields V1 agent frontmatter used that V2 forbids. Stripped on sight so a repo
// upgraded in place does not carry a definition V2 refuses to load.
const LEGACY_FIELDS = [
  "model",
  "permission",
  "prompt",
  "disable",
  "disabled",
  "temperature",
  "top_p",
  "maxSteps",
  "tools",
]

// Mirrors cli/utils/agent-color.js in the CLI, duplicated because a plugin has
// to stand alone in the consumer repo. agent-color.test.js asserts the two stay
// in step; change one and change the other.
//
// Only the hue is hashed. Fixed saturation and lightness are what keep every
// result usable: hashing those too would eventually produce a near-grey,
// near-black or near-white agent, invisible against one theme or the other.
function agentColor(name) {
  let h = 0x811c9dc5
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  const hue = (h >>> 0) % 360
  const sat = 0.68
  const light = 0.52
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = light - c / 2
  const [r, g, b] =
    hue < 60 ? [c, x, 0] :
    hue < 120 ? [x, c, 0] :
    hue < 180 ? [0, c, x] :
    hue < 240 ? [0, x, c] :
    hue < 300 ? [x, 0, c] :
    [c, 0, x]
  const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

/** A theme keyword or a missing value yields to the derived hex; a hex stays. */
function shouldDeriveColor(current) {
  if (!current) return true
  return THEME_COLORS.has(current.trim().toLowerCase())
}

/**
 * Render a colour for YAML frontmatter.
 *
 * A hex has to be quoted. `#` opens a comment in YAML, so `color: #D83155`
 * parses as null and opencode refuses the agent with "Invalid input color".
 * Theme keywords need no quoting and stay bare.
 */
function yamlColor(value) {
  return value.startsWith("#") ? `"${value}"` : value
}

function unquoteColor(raw) {
  return (raw ?? "").trim().replace(/^["']/, "").replace(/["']$/, "")
}

function splitFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { frontmatter: null, body: content }
  return { frontmatter: match[1], body: content.slice(match[0].length) }
}

function stripLegacyFields(frontmatter) {
  const lines = frontmatter.split(/\r?\n/)
  const kept = []
  for (let i = 0; i < lines.length; i++) {
    const key = lines[i].match(/^([A-Za-z0-9_-]+):/)?.[1]
    if (key && LEGACY_FIELDS.includes(key)) {
      // Drop the key and any indented continuation lines that belong to it.
      i++
      while (i < lines.length && /^\s+\S/.test(lines[i])) i++
      i--
      continue
    }
    kept.push(lines[i])
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

function setScalar(frontmatter, key, value) {
  const line = `${key}: ${value}`
  // String operations rather than a built RegExp: `key` is one of this module's
  // own constants, so the pattern would be safe, but a dynamic regexp here is a
  // ReDoS-shaped pattern that static analysis rightly refuses to clear.
  const lines = frontmatter.split(/\r?\n/)
  const index = lines.findIndex(current => current.startsWith(`${key}:`))
  if (index === -1) {
    return frontmatter ? `${line}\n${frontmatter}` : line
  }
  lines[index] = line
  return lines.join("\n")
}

function permissionsYaml(permissions) {
  return [
    "permissions:",
    ...permissions.flatMap(p => [
      `  - action: ${p.action}`,
      `    resource: ${p.resource}`,
      `    effect: ${p.effect}`,
    ]),
  ].join("\n")
}

/** The colour line an agent should have, or null when the current one is right. */
function colorLineFor(name, rawCurrent) {
  const current = unquoteColor(rawCurrent)
  const target = shouldDeriveColor(current) ? agentColor(name) : current
  const rendered = yamlColor(target)
  return (rawCurrent ?? "").trim() === rendered ? null : `color: ${rendered}`
}

const FULLSTACK_NAME = "fullstack-engineer"
const FULLSTACK_TEMPLATE = `${FULLSTACK_NAME}.md`

/** Rewrite a template's frontmatter to a clean V2 subagent definition. */
function normalizeTemplate(content, name) {
  const { frontmatter, body } = splitFrontmatter(content)
  if (frontmatter === null) return `---\nmode: subagent\ncolor: ${yamlColor(agentColor(name))}\n---\n\n${content}`

  let fm = stripLegacyFields(frontmatter)
  fm = setScalar(fm, "mode", "subagent")
  const colorLine = colorLineFor(name, fm.match(/^color:\s*(.+)$/m)?.[1])
  if (colorLine) fm = setScalar(fm, "color", colorLine.slice("color: ".length))
  return `---\n${fm}\n---\n${body}`
}

/** A tier-pinned copy of a specialist: same body, resolved model. */
function buildVariant(templateContent, model) {
  const { frontmatter, body } = splitFrontmatter(templateContent)
  let fm = stripLegacyFields(frontmatter ?? "")
  fm = setScalar(fm, "mode", "subagent")
  fm = setScalar(fm, "model", model)
  // Hidden by default: a tier is chosen by whoever writes the task, not picked
  // from the @ menu. Without this the menu lists every specialist once per tier.
  fm = setScalar(fm, "hidden", "true")
  if (!/^color:/m.test(fm)) {
    const name = ""
    fm = setScalar(fm, "color", name ? yamlColor(agentColor(name)) : yamlColor(agentColor("engineer")))
  }
  return `---\n${fm}\n---\n${body}`
}

/**
 * Build a primary from the fullstack body: same identity and the same
 * ## Abilities block, with our own frontmatter on top. The body is taken
 * verbatim so /make-engineer only has to maintain fullstack-engineer.md and
 * both primaries inherit whatever it lists.
 */
function buildPrimary(spec, fullstackContent, model) {
  const { body } = splitFrontmatter(fullstackContent)
  const lines = [
    "---",
    `description: ${spec.description}`,
    "mode: primary",
  ]
  if (model) lines.push(`model: ${model}`)
  lines.push(`color: ${yamlColor(spec.color)}`)
  if (spec.permissions) lines.push(permissionsYaml(spec.permissions))
  lines.push("---")
  return `${lines.join("\n")}\n\n${body.trim()}\n`
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8"))
  } catch {
    return null
  }
}

async function scanEngineers(agentsDir) {
  try {
    const entries = await fs.readdir(agentsDir)
    return {
      templates: entries
        .filter(f => /^[\w-]+-engineer\.md$/.test(f) && f !== FULLSTACK_TEMPLATE)
        .map(f => f.replace(/\.md$/, "")),
      variantFiles: entries.filter(f => /^[\w-]+-engineer\.(build|fast|plan)\.md$/.test(f)),
      hasFullstack: entries.includes(FULLSTACK_TEMPLATE),
    }
  } catch {
    return { templates: [], variantFiles: [], hasFullstack: false }
  }
}

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

export default Plugin.define({
  id: "pc.subagent-tiers",
  async setup(ctx) {
    const root = ctx.location.directory
    const agentsDir = path.join(root, ".opencode", "agents")

    try {
      const [user, team] = await Promise.all([
        readJson(path.join(root, ".opencode", "harness.user.json")),
        readJson(path.join(root, ".opencode", "harness.json")),
      ])
      const models = {}
      for (const tier of TIERS) {
        models[tier] = user?.models?.[tier] ?? team?.models?.[tier] ?? null
      }
      const available = TIERS.filter(t => models[t])

      const { templates, variantFiles, hasFullstack } = await scanEngineers(agentsDir)

      if (hasFullstack) {
        const fullstackPath = path.join(agentsDir, FULLSTACK_TEMPLATE)
        const rawFullstack = await fs.readFile(fullstackPath, "utf-8")
        const fullstack = normalizeTemplate(rawFullstack, FULLSTACK_NAME)
        if (fullstack !== rawFullstack) {
          await writeIfChanged(fullstackPath, fullstack)
          console.error("[pc-subagent-tiers] Normalized fullstack-engineer.md (V2 subagent)")
        }

        for (const [name, spec] of Object.entries(PRIMARIES)) {
          await writeIfChanged(
            path.join(agentsDir, `${name}.md`),
            buildPrimary(spec, fullstack, models[spec.tier]),
          )
        }
        console.error(`[pc-subagent-tiers] Wrote primaries: build (${models.build ?? "session model"}), plan (${models.plan ?? "session model"})`)
      } else {
        console.error(`[pc-subagent-tiers] ${FULLSTACK_TEMPLATE} missing: build and plan not generated`)
      }

      const keepSet = new Set()
      const variantsToWrite = []
      for (const name of templates) {
        const rawContent = await fs.readFile(path.join(agentsDir, `${name}.md`), "utf-8")
        const content = normalizeTemplate(rawContent, name)
        if (content !== rawContent) {
          await writeIfChanged(path.join(agentsDir, `${name}.md`), content)
          console.error(`[pc-subagent-tiers] Normalized ${name}.md (V2 subagent)`)
        }
        for (const tier of available) {
          const file = `${name}.${tier}.md`
          variantsToWrite.push({ file, path: path.join(agentsDir, file), content: buildVariant(content, models[tier]) })
          keepSet.add(file)
        }
      }

      await Promise.all(variantsToWrite.map(v => writeIfChanged(v.path, v.content)))
      await Promise.all(
        variantFiles.filter(f => !keepSet.has(f)).map(f => fs.unlink(path.join(agentsDir, f)).catch(() => {})),
      )

      if (variantsToWrite.length > 0) {
        console.error(`[pc-subagent-tiers] Created ${variantsToWrite.length} variant files (${templates.length} engineers x ${available.length} tiers)`)
      } else if (templates.length > 0) {
        console.error(`[pc-subagent-tiers] No variants created. Models: ${JSON.stringify(models)}`)
      }

      // Best effort: if V2 already discovered these agents (same startup), pin
      // the primaries' model and plan's read-only permissions in memory too.
      if (typeof ctx.agent?.transform === "function") {
        await ctx.agent.transform(editor => {
          for (const [id, spec] of Object.entries(PRIMARIES)) {
            const existing = editor.get(id)
            if (!existing) continue
            const model = models[spec.tier]
            if (model) {
              try {
                existing.model = Model.Ref.parse(model)
              } catch {
                // invalid model ref; leave undefined so session model applies
              }
            }
            existing.mode = "primary"
            existing.description = spec.description
            if (spec.permissions) existing.permissions = spec.permissions
          }
        })
        await ctx.agent.reload?.()
      }
    } catch (error) {
      console.error(`[pc-subagent-tiers] Error: ${error?.message}`)
    }
  },
})
