import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse as parseJsonc } from "jsonc-parser"
import { describe, expect, it } from "vitest"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTENT_DIR = path.resolve(__dirname, "../harness")

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
    expect(verify).toContain("git diff")
    expect(verify).toContain("dependency manifest changes")
    expect(verify).toContain("immutable dependency install or restore command")
    expect(verify).toContain("build command, and test command")
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

  function walk(dir) {
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const full = path.join(dir, entry.name)
      return entry.isDirectory() ? walk(full) : full.endsWith(".md") ? [full] : []
    })
  }

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
  it("does not tell the model to follow every step", () => {
    const commands = walk(path.join(CONTENT_DIR, ".opencode", "commands"))
    const offenders = [...authored, ...commands].filter(f => read(f).includes("follow every step"))
    expect(offenders.map(f => path.relative(CONTENT_DIR, f))).toEqual([])
  })

  // A step number into @openspec-apply-change breaks silently when upstream
  // renumbers, and upstream is installed unpinned via `openspec init --force`.
  it("references no upstream step by number", () => {
    const offenders = authored.filter(f => /replacing Step \d|Replace the default step \d/i.test(read(f)))
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

// The always-loaded context is paid on every single request, before any skill
// loads. Constraint-based rewrites should shrink it; nothing should grow it
// without someone deciding to.
describe("always-loaded context budget", () => {
  it("stays within its measured baseline", () => {
    const bytes = [
      path.join(CONTENT_DIR, "AGENTS.md"),
      path.join(CONTENT_DIR, ".agents", "skills", "pc-guardrails-generic", "SKILL.md"),
    ].reduce((total, file) => total + fs.readFileSync(file, "utf-8").length, 0)

    // Baseline at the time of the truth pass: 11,436 chars for these two.
    expect(bytes).toBeLessThanOrEqual(11_600)
  })
})
