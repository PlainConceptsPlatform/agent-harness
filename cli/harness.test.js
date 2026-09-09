import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse as parseJsonc } from "jsonc-parser"
import { describe, expect, it } from "vitest"
import { SKILL_RENAME } from "./steps/copy/skills.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTENT_DIR = path.resolve(__dirname, "../harness")

// Flags rules that are near-verbatim restatements of each other, by content-word
// overlap. Takes {label: text}, returns the collisions.
//
// This catches copy-paste, which is what actually happened: the credentials rule
// was pasted into two sections of one file. It does NOT catch a rule restated in
// different words — "Run tests before marking done" and "Run the applicable
// tests, lint, typecheck, and build before reporting completion" share exactly
// one content word, and no string metric will pair them. That class is what the
// single-home comment table above is for; a person has to notice it.
function duplicateRules(sources, threshold = 0.5) {
  const STOP = new Set(["the", "a", "an", "and", "or", "to", "in", "of", "for", "it", "is", "are",
    "be", "that", "this", "with", "your", "you", "any", "all", "on", "at", "as", "by", "from", "not"])

  const contentWords = rule => new Set(
    rule
      .replace(/^\s*[-*] /, "")
      .toLowerCase()
      .replace(/`[^`]*`/g, " ")
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(word => word.length > 2 && !STOP.has(word)),
  )

  const rules = Object.entries(sources).flatMap(([label, text]) =>
    text.split(/\r?\n/)
      .filter(line => /^\s*[-*] /.test(line))
      .map(line => ({ label, line, words: contentWords(line) })),
  )

  const collisions = []
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const [a, b] = [rules[i], rules[j]]
      if (a.words.size < 3 || b.words.size < 3) continue
      const shared = [...a.words].filter(word => b.words.has(word)).length
      const union = new Set([...a.words, ...b.words]).size
      if (shared / union >= threshold) {
        collisions.push(`${a.label} + ${b.label}: ${a.line.trim().slice(0, 60)}`)
      }
    }
  }
  return collisions
}

function walkMd(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walkMd(full) : full.endsWith(".md") ? [full] : []
  })
}

describe("OpenCode config template", () => {
  it("ships the project config as root JSONC", () => {
    expect(fs.existsSync(path.join(CONTENT_DIR, "opencode.jsonc"))).toBe(true)
    expect(fs.existsSync(path.join(CONTENT_DIR, ".opencode", "opencode.json"))).toBe(false)
  })

  it("pins external OpenCode plugins and the agent-browser MCP server", () => {
    const config = parseJsonc(fs.readFileSync(path.join(CONTENT_DIR, "opencode.jsonc"), "utf-8"))
    const packageConfig = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, ".opencode", "package.json"), "utf-8"))
    const quota = JSON.parse(fs.readFileSync(path.join(__dirname, "presets", "quota.json"), "utf-8"))

    expect(config.plugin).toEqual([
      "@mohak34/opencode-notifier@0.2.8",
    ])
    expect(config.mcp["agent-browser"]).toEqual({
      type: "local",
      command: ["agent-browser", "mcp", "--tools", "core"],
      enabled: true,
    })
    expect(config.plugin.join(" ")).not.toContain("@different-ai/opencode-browser")
    expect(packageConfig.dependencies["@opencode-ai/plugin"]).toBe("1.18.19")
    expect(packageConfig.dependencies["@opentui/core"]).toBe("0.5.6")
    expect(packageConfig.dependencies["@different-ai/opencode-browser"]).toBeUndefined()
    expect(packageConfig.dependencies["@mohak34/opencode-notifier"]).toBe("0.2.8")
    expect(quota.plugin).toBe("@slkiser/opencode-quota@4.2.0")
  })

  it("ships the always-on system reminder plugin", () => {
    const plugin = fs.readFileSync(path.join(CONTENT_DIR, ".opencode", "plugins", "pc-system-reminders.js"), "utf-8")

    expect(plugin).toContain("experimental.chat.messages.transform")
    expect(plugin).toContain("pc-guardrails-generic")
  })

  // The rules the harness states as "never" are denied in a hook rather than
  // argued for in prose. Two plugins carry that, and the prose that points at
  // them (below) is only true while the hook is there.
  it("enforces the never-rules in tool.execute.before", () => {
    const plugins = path.join(CONTENT_DIR, ".opencode", "plugins")
    const reminders = fs.readFileSync(path.join(plugins, "pc-system-reminders.js"), "utf-8")
    const monitor = fs.readFileSync(path.join(plugins, "pc-subagent-monitor.js"), "utf-8")

    expect(reminders).toContain("tool.execute.before")
    expect(monitor).toContain("tool.execute.before")

    // The agent never arrives with the hook input, so the deny needs the
    // session-to-agent map that chat.params fills.
    expect(reminders).toContain("chat.params")

    // A gate over the tools that satisfy the gate would deadlock the session.
    const gated = /GATED_TOOLS = new Set\(\[([^\]]*)\]\)/.exec(reminders)?.[1] ?? ""
    expect(gated).toContain("edit")
    expect(gated).toContain("bash")
    expect(gated).toContain("task")
    for (const tool of ["skill", "read", "grep", "glob"]) {
      expect(gated).not.toContain(`"${tool}"`)
    }
  })

  it("denies edit and task for the plan primary", () => {
    const tiers = fs.readFileSync(path.join(CONTENT_DIR, ".opencode", "plugins", "pc-subagent-tiers.js"), "utf-8")
    const config = parseJsonc(fs.readFileSync(path.join(CONTENT_DIR, "opencode.jsonc"), "utf-8"))

    // Read-only has to include spawning: a plan session that can call task()
    // can have a build worker make the change for it.
    expect(tiers).toContain(`permission: { edit: "deny", task: "deny" }`)
    expect(config.agent.plan.permission).toEqual({ edit: "deny", task: "deny" })
  })
})

function skill(name, file = "SKILL.md") {
  return fs.readFileSync(path.join(CONTENT_DIR, ".agents", "skills", name, file), "utf-8")
}

describe("planning skill templates", () => {
  it("ships repo audit and verification commands with their matching skills", () => {
    const auditCommand = fs.readFileSync(path.join(CONTENT_DIR, ".opencode", "commands", "repo-audit.md"), "utf-8")
    const verifyCommand = fs.readFileSync(path.join(CONTENT_DIR, ".opencode", "commands", "repo-verify.md"), "utf-8")
    const audit = skill("pc-repo-audit")
    const verify = skill("pc-repo-verify")

    expect(auditCommand).toContain("Load the `pc-repo-audit` skill")
    expect(verifyCommand).toContain("Load the `pc-repo-verify` skill")
    expect(audit).toContain("without modifying files")
    expect(audit).toContain("fullstack-engineer.md")

    // Pin what verification means, not how the skill words its steps: a scoped
    // diff, an immutable install (so a stale lockfile fails instead of being
    // silently updated), and the sentinel the pipeline gates on.
    expect(verify).toContain("git diff")
    expect(verify).toMatch(/immutable/)
    expect(verify).toMatch(/lockfile/)
    expect(verify).toMatch(/\bVERIFIED\b/)
    expect(verify).toMatch(/NOT VERIFIED/)
  })

  it("keeps plan-explore delegating to openspec-explore", () => {
    const explore = skill("pc-plan-explore")

    expect(explore).toContain("@openspec-explore")
    expect(explore).not.toContain("requirement-model.md")
    expect(explore).not.toContain("exploration-brief.md")
    // openspec-explore states it has no steps ("a stance, not a workflow"), so
    // telling the model to follow every one of them was a category error.
    expect(explore).not.toContain("follow every step")
  })

  it("defines EXPLORATION_BRIEF on both sides of the handoff", () => {
    const goal = skill("pc-plan-goal")
    const explore = skill("pc-plan-explore")

    expect(goal).toContain("Load `pc-plan-explore`")
    expect(goal).not.toContain("pc-goal-explore")
    // plan-goal required this handoff while plan-explore never defined it.
    expect(goal).toContain("EXPLORATION_BRIEF")
    expect(explore).toContain("EXPLORATION_BRIEF")
  })

  it("requires workers for annotated OpenSpec tasks", () => {
    const apply = skill("pc-plan-apply")
    const propose = skill("pc-plan-propose")

    expect(apply).toContain("never become sequential lead work")
    expect(apply).toContain("resolve every task's annotated worker")
    expect(apply).toContain("missing worker stops the stage before spawning")
    expect(propose).toContain("never substitute the lead or an obsolete generic agent name")
    expect(propose).not.toContain("or use `fullstack-engineer`")
    expect(propose).not.toContain("basic-engineer")
  })

  it("keeps optional optimization guidance behind markers", () => {
    const apply = skill("pc-plan-apply")

    expect(apply).toContain("<!-- PC-OPTIMIZATION-CODEGRAPH-START -->")
    expect(apply).toContain("<!-- PC-OPTIMIZATION-MEMORY-START -->")
    expect(apply).not.toContain("codegraph_explore")
    expect(apply).not.toContain("Agentmemory")
  })

  it("keeps phase procedures with their owning skills", () => {
    const goal = skill("pc-plan-goal")
    const apply = skill("pc-plan-apply")
    const archive = skill("pc-plan-archive")

    expect(goal).toContain("every task complete and `VERIFIED`")
    expect(goal).toContain("Require `ARCHIVED_OK` and the archive path")
    expect(apply).toContain("Every command must exit 0")
    expect(archive).toContain("run the archive once more and repeat the check")
    expect(goal).toContain("then load `pc-repo-verify`")
  })

  it("keeps plan-goal as a compact orchestrator", () => {
    const goal = skill("pc-plan-goal")
    const output = skill("pc-plan-goal", "output.md")

    expect(goal.split("\n").length).toBeLessThan(120)
    expect(goal).toContain("Follow the [branching procedure](branching.md)")
    expect(goal).toContain("Follow the [output procedure](output.md)")
    expect(output).toContain("## Final report")
  })

  it("keeps temporary artifacts inside the repository", () => {
    const guardrails = skill("pc-guardrails-generic")
    const evidence = skill("pc-ops-evidence")

    expect(guardrails).toContain("$REPO_ROOT/.opencode/.tmp/")
    expect(evidence).toContain("capturePlan")
  })

  it("requires evidence skill to write capturePlan and scaffold to be deprecated", () => {
    const scaffold = skill("pc-make-evidence-scaffold")
    const evidence = skill("pc-ops-evidence")

    expect(scaffold).toContain("DEPRECATED")
    expect(evidence).toContain("capturePlan")
    expect(evidence).toContain("Visual Evidence CI workflow")
  })
})

// Where each rule lives. Several of these were stated in three places at once,
// so a fix landed in one copy and the other two silently disagreed. One home
// each, and these assertions keep it that way.
//
//   never `git add -A`            pc-guardrails-generic  (enforced: see below)
//   worker is not substitutable   pc-plan-apply
//   agents.maxConcurrent          pc-plan-apply
//   scratch files under .tmp      pc-guardrails-generic
//   platform data via CLI only    pc-guardrails-generic
//   story format                  pc-plan-story
//   scoped verification           pc-repo-verify
describe("each rule has one home", () => {
  const SKILLS_DIR = path.join(CONTENT_DIR, ".agents", "skills")
  const FRAGMENTS_DIR = path.resolve(__dirname, "fragments")

  const walk = walkMd

  const authored = [...walk(SKILLS_DIR), ...walk(FRAGMENTS_DIR)]
  const read = file => fs.readFileSync(file, "utf-8")

  // archive/*.md told the model to `git add -A` while ops-ship/*.md forbade it.
  it("instructs an unscoped git add nowhere", () => {
    const offenders = authored.filter(f => /git add (-A|--all|\.)(\s|$)/m.test(read(f)))
    expect(offenders.map(f => path.relative(CONTENT_DIR, f))).toEqual([])
  })

  // Every derived agent colour must be quoted: a bare #hex is a YAML comment.
  it("quotes every hex colour it writes", () => {
    const offenders = authored.filter(f => /^color:\s*#/m.test(read(f)))
    expect(offenders.map(f => path.relative(CONTENT_DIR, f))).toEqual([])
  })

  // The command wrapper turns a skill into a recipe before the model reads a
  // word of it, and it is wrong about openspec-explore, which has no steps.
  // Case-sensitively this passed while pc-repo-initialize said "Follow every
  // step defined in it" three times.
  it("does not tell the model to follow every step", () => {
    const commands = walk(path.join(CONTENT_DIR, ".opencode", "commands"))
    const offenders = [...authored, ...commands].filter(f => /follow (every step|all steps|its steps)/i.test(read(f)))
    expect(offenders.map(f => path.relative(CONTENT_DIR, f))).toEqual([])
  })

  // A step number into @openspec-apply-change breaks silently when upstream
  // renumbers, and upstream is installed unpinned via `openspec init --force`.
  it("references no upstream step by number", () => {
    const offenders = authored.filter(f => /replacing Step \d|Replace the default step \d/i.test(read(f)))
    expect(offenders.map(f => path.relative(CONTENT_DIR, f))).toEqual([])
  })

  // A rule with a hook behind it is stated once, next to the mechanism that
  // enforces it. Restating it elsewhere is how the three copies drifted apart.
  it("states an enforced rule once, and says what enforces it", () => {
    const offenders = authored.filter(f => /MANDATORY LOAD|not optional|you enforce the cap/i.test(read(f)))
    expect(offenders.map(f => path.relative(CONTENT_DIR, f))).toEqual([])

    // Patches aimed at a model that stops early, rather than a statement of
    // where the stage actually ends. The pipeline owns its own continuation.
    const patched = authored.filter(f => /do ?n[o']t end the turn|remain read-only|this is not optional/i.test(read(f)))
    expect(patched.map(f => path.relative(CONTENT_DIR, f))).toEqual([])

    // A skill that claims a plugin loads its abilities for it, or that the
    // reminder is the load, was wrong even before the gate existed.
    const claims = authored.filter(f => /plugin (loads|already loaded)/i.test(read(f)))
    expect(claims.map(f => path.relative(CONTENT_DIR, f))).toEqual([])
  })

  // The transitive-load rule is parsed, not just read: pc-system-reminders
  // pulls `skill("x")` out of the guardrails body and requires it. A worked
  // example with a placeholder name put a skill nobody can install on that
  // list, and the reminder then asked for it every turn for the whole session.
  it("uses the parsed skill() form only for real skill names", () => {
    const skillsDir = path.join(CONTENT_DIR, ".agents", "skills")
    const installable = new Set(fs.readdirSync(skillsDir))
    const referenced = [...walk(SKILLS_DIR), ...walk(FRAGMENTS_DIR)].flatMap(file =>
      [...read(file).matchAll(/skill\(["`]([a-z0-9][a-z0-9-]*)["`]\)/gi)].map(match => ({
        file: path.relative(CONTENT_DIR, file),
        name: match[1],
      })),
    )

    // Optimization skills are installed by `skills add`, not shipped here.
    const external = new Set(["simple-english", "humanizer", "codegraph", "agentmemory"])
    const dangling = referenced.filter(entry => !installable.has(entry.name) && !external.has(entry.name))
    expect(dangling).toEqual([])
  })

  // Twelve ops fragments opened with a bolded restatement of the same rule,
  // which is now denied in a hook. What is left is the one real difference
  // between them: whether a missing CLI blocks or skips.
  it("opens no ops fragment with a bolded platform rule", () => {
    const opsFragments = walk(FRAGMENTS_DIR).filter(f => /[\\/]ops-/.test(f))
    expect(opsFragments.length).toBe(12)

    const offenders = opsFragments.filter(f => /^\*\*/.test(read(f).trimStart()))
    expect(offenders.map(f => path.relative(CONTENT_DIR, f))).toEqual([])
  })

  // Shouting is not enforcement. Budget of two per file; the two ops-ship
  // fragments were the only ones over it.
  it("keeps all-caps imperatives within budget", () => {
    const over = authored
      .map(f => {
        const withoutFences = read(f).replace(/```[\s\S]*?```/g, "")
        const shouts = withoutFences.match(/\b(MUST|NEVER|ALWAYS|MANDATORY|STOP)\b/g) ?? []
        return { file: path.relative(CONTENT_DIR, f), count: shouts.length }
      })
      .filter(entry => entry.count > 2)
    expect(over).toEqual([])
  })
})

// Structure a reader (or a patcher) can rely on without opening the file.
describe("skills hold together as files", () => {
  const SKILLS_DIR = path.join(CONTENT_DIR, ".agents", "skills")
  const skillDirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)

  // `name:` is what the `skill` tool is called with and what the reminder
  // plugin matches a load against, so a mismatch makes a skill unloadable.
  it("names each skill after its directory, modulo the install rename", () => {
    const mismatched = skillDirs.flatMap(dir => {
      const content = fs.readFileSync(path.join(SKILLS_DIR, dir, "SKILL.md"), "utf-8")
      const declared = /^name:\s*(\S+)\s*$/m.exec(content)?.[1]
      const expected = SKILL_RENAME[dir] ?? dir
      return declared === expected ? [] : [{ dir, declared, expected }]
    })
    expect(mismatched).toEqual([])
  })

  // A `#` in an unquoted YAML value starts a comment and a `: ` breaks the
  // mapping outright, which silently costs the skill its description: the very
  // field `/plan-apply` matches a task against.
  it("keeps every frontmatter value parseable", () => {
    const offenders = [...walkMd(SKILLS_DIR), ...walkMd(path.join(CONTENT_DIR, ".opencode", "commands"))]
      .flatMap(file => {
        const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(file, "utf-8"))?.[1] ?? ""
        return frontmatter.split("\n").flatMap(line => {
          const value = /^[a-z_]+:\s+(.*)$/.exec(line.trim())?.[1]
          if (!value || /^["'[]/.test(value)) return []
          return /: |#/.test(value) ? [`${path.relative(CONTENT_DIR, file)}: ${value.slice(0, 40)}`] : []
        })
      })
    expect(offenders).toEqual([])
  })

  it("resolves every relative link a skill makes", () => {
    const broken = walkMd(SKILLS_DIR).flatMap(file =>
      [...fs.readFileSync(file, "utf-8").matchAll(/\]\((?!https?:|#)([^)]+\.md)\)/g)]
        .filter(match => !fs.existsSync(path.resolve(path.dirname(file), match[1])))
        .map(match => `${path.relative(CONTENT_DIR, file)} -> ${match[1]}`),
    )
    expect(broken).toEqual([])
  })

  it("points every command at a skill that exists", () => {
    const installed = new Set(skillDirs.map(dir => SKILL_RENAME[dir] ?? dir))
    const dangling = walkMd(path.join(CONTENT_DIR, ".opencode", "commands")).flatMap(file =>
      [...fs.readFileSync(file, "utf-8").matchAll(/Load the `(pc-[a-z-]+)` skill/g)]
        .filter(match => !installed.has(match[1]))
        .map(match => `${path.basename(file)} -> ${match[1]}`),
    )
    expect(dangling).toEqual([])
  })

  // The worked example for the constraint rewrite: three files, 367 lines of
  // menus, display formats and self-checks, none of which anything parsed.
  it("keeps pc-make-engineer within its rewritten budget", () => {
    const lines = ["SKILL.md", "template.md", "signal-mapping.md"]
      .map(file => fs.readFileSync(path.join(SKILLS_DIR, "pc-make-engineer", file), "utf-8").split("\n").length)
      .reduce((total, count) => total + count, 0)
    expect(lines).toBeLessThanOrEqual(160)
  })
})

// The always-loaded context is paid on every single request, before any skill
// loads. Constraint-based rewrites should shrink it; nothing should grow it
// without someone deciding to.
//
// Two budgets, because rule *count* and character count fail differently.
// Characters are tokens. Count is compliance: past roughly fifty rules a model
// follows fewer of them whatever they say, so rule 41 does not merely cost its
// own tokens, it dilutes the forty that matter. Measured before this pass: 48
// rules and 10,354 rendered characters.
describe("always-loaded context budget", () => {
  const AGENTS = path.join(CONTENT_DIR, "AGENTS.md")
  const GUARDRAILS = path.join(CONTENT_DIR, ".agents", "skills", "pc-guardrails-generic", "SKILL.md")
  const read = file => fs.readFileSync(file, "utf-8")
  const bullets = text => text.match(/^\s*[-*] /gm) ?? []
  const rulesIn = text => text.split(/\r?\n/).filter(line => /^\s*[-*] /.test(line))

  // Everything a consumer actually has in context on request one: AGENTS.md
  // with the platform preset injected at its two markers (copy/agents.js), and
  // pc-guardrails-generic with the optimization fragments injected at its five
  // (optimization/patch-guardrails.js).
  function renderAlwaysLoaded(platform = "github") {
    const preset = JSON.parse(fs.readFileSync(path.resolve(__dirname, "presets", "agents-content.json"), "utf-8"))
    const entry = preset.platform[platform]
    const fragments = walkMd(path.resolve(__dirname, "fragments", "guardrails")).map(read)
    return [read(AGENTS), entry.workflow ?? "", entry.skillsGuide ?? "", read(GUARDRAILS), ...fragments].join("\n")
  }

  it("stays within its measured character baseline", () => {
    // 6,226 for the two files as shipped; 8,823 rendered with every injection.
    expect(read(AGENTS).length + read(GUARDRAILS).length).toBeLessThanOrEqual(6_500)
    expect(renderAlwaysLoaded().length).toBeLessThanOrEqual(9_200)
  })

  it("stays within its rule budget", () => {
    // 33 as shipped: AGENTS 9 + workflow 3 + skillsGuide 2 + guardrails 9 +
    // fragments 10. The fragments are positive directives and stay: which
    // analysis tools this project selected is not inferable from the code.
    expect(bullets(renderAlwaysLoaded()).length).toBeLessThanOrEqual(36)
  })

  // A positive directive competes with what the model already does; a
  // prohibition removes an option. The always-loaded files are where that
  // matters most, so most of their rules state a boundary.
  it("keeps the always-loaded rules mostly negative", () => {
    const rules = [...rulesIn(read(AGENTS)), ...rulesIn(read(GUARDRAILS))]
    const negative = rules.filter(rule => /\b(never|nothing but|only with|not up to you)\b/i.test(rule))

    // 12 of 18 at the time of the pass. A floor, not a ratio: adding one
    // non-inferable contract should not fail the build.
    expect(negative.length).toBeGreaterThanOrEqual(9)
    expect(negative.length * 2).toBeGreaterThan(rules.length)
  })

  // "Run tests before marking done" lived in AGENTS.md, in pc-guardrails-generic
  // twice, and in pc-repo-verify. Both always-loaded files land in the same
  // context window, so a rule in both is paid twice per request.
  it("states no rule twice across the always-loaded files", () => {
    expect(duplicateRules({
      "AGENTS.md": read(AGENTS),
      "pc-guardrails-generic": read(GUARDRAILS),
    })).toEqual([])
  })

  // The detector has to actually detect. This pair was live in one file, in two
  // sections, until this pass.
  it("catches the copy-pasted rule that was there before", () => {
    const found = duplicateRules({
      "old guardrails": [
        "- Stage secrets through environment variables or secret stores, committed only in encrypted or template form.",
        "- Keep credentials in environment variables or secret stores, committed only in encrypted or template form.",
      ].join("\n"),
    })

    expect(found).toHaveLength(1)
  })
})

// These two files are read once per project and then shape every rule that
// project's agents carry forever, so their bar multiplies. Both landed their
// consumers at 90-120 rules with no cap in sight.
describe("the guardrail generators state their bar", () => {
  it.each([
    ["pc-make-guardrails", "rules"],
    ["pc-make-merge-risk-assess", "indicators"],
  ])("%s caps the output and skips what is already enforced", (skill, noun) => {
    const reference = fs.readFileSync(
      path.join(CONTENT_DIR, ".agents", "skills", skill, "category-reference.md"), "utf-8")

    expect(reference).toMatch(new RegExp(`at most 40 ${noun}`, "i"))
    expect(reference).toMatch(/already fails the build on|already fails the build|CI already fails/i)
  })

  // Numa's quoting domain shipped as the canonical wording for two categories,
  // so every other project inherited its business as the example.
  it("ships no project's domain as the canonical wording", () => {
    const reference = fs.readFileSync(
      path.join(CONTENT_DIR, ".agents", "skills", "pc-make-merge-risk-assess", "category-reference.md"), "utf-8")
    const [, slot = ""] = /<!-- PC-PROJECT-EXAMPLE-START -->([\s\S]*?)<!-- PC-PROJECT-EXAMPLE-END -->/.exec(reference) ?? []
    const outsideSlot = reference.replace(slot, "")

    expect(reference).toContain("<!-- PC-PROJECT-EXAMPLE-START -->")
    for (const leaked of ["salary", "margin waterfall", "QuoteCalculator"]) {
      expect(outsideSlot).not.toContain(leaked)
    }
  })
})
