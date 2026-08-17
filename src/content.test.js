import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTENT_DIR = path.join(__dirname, "content")

describe("OpenCode config template", () => {
  it("ships the project config as root JSONC", () => {
    expect(fs.existsSync(path.join(CONTENT_DIR, "opencode.jsonc"))).toBe(true)
    expect(fs.existsSync(path.join(CONTENT_DIR, ".opencode", "opencode.json"))).toBe(false)
  })

  it("pins external OpenCode plugins", () => {
    const config = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "opencode.jsonc"), "utf-8"))
    const packageConfig = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, ".opencode", "package.json"), "utf-8"))
    const quota = JSON.parse(fs.readFileSync(path.join(__dirname, "presets", "quota.json"), "utf-8"))

    expect(config.plugin).toEqual([
      "@different-ai/opencode-browser@4.6.1",
      "@mohak34/opencode-notifier@0.2.8",
    ])
    expect(packageConfig.dependencies["@opencode-ai/plugin"]).toBe("1.17.13")
    expect(packageConfig.dependencies["@different-ai/opencode-browser"]).toBe("4.6.1")
    expect(packageConfig.dependencies["@mohak34/opencode-notifier"]).toBe("0.2.8")
    expect(quota.plugin).toBe("@slkiser/opencode-quota@4.2.0")
  })
})

function skill(name, file = "SKILL.md") {
  return fs.readFileSync(path.join(CONTENT_DIR, ".agents", "skills", name, file), "utf-8")
}

describe("planning skill templates", () => {
  it("ships repo audit and verification commands with their matching skills", () => {
    const auditCommand = fs.readFileSync(path.join(CONTENT_DIR, ".opencode", "commands", "repo-audit.md"), "utf-8")
    const verifyCommand = fs.readFileSync(path.join(CONTENT_DIR, ".opencode", "commands", "repo-verify.md"), "utf-8")
    const audit = skill("ob-repo-audit")
    const verify = skill("ob-repo-verify")

    expect(auditCommand).toContain("Load the `ob-repo-audit` skill")
    expect(verifyCommand).toContain("Load the `ob-repo-verify` skill")
    expect(audit).toContain("without modifying files")
    expect(audit).toContain("fullstack-engineer.md")
    expect(verify).toContain("git diff")
    expect(verify).toContain("dependency manifest changes")
    expect(verify).toContain("immutable dependency install or restore command")
    expect(verify).toContain("build command, and test command")
  })

  it("keeps plan-explore as an openspec-explore facade", () => {
    const explore = skill("ob-plan-explore")

    expect(explore).toContain("Load `@openspec-explore` and follow every step defined in it.")
    expect(explore).not.toContain("requirement-model.md")
    expect(explore).not.toContain("exploration-brief.md")
  })

  it("makes plan-goal exploration think before it validates code", () => {
    const goal = skill("ob-plan-goal")

    expect(goal).toContain("Load `ob-plan-explore`")
    expect(goal).toContain("Require an in-memory `EXPLORATION_BRIEF`")
    expect(goal).not.toContain("ob-goal-explore")
  })

  it("requires workers for annotated OpenSpec tasks", () => {
    const apply = skill("ob-plan-apply")
    const propose = skill("ob-plan-propose")

    expect(apply).toContain("never become sequential lead work")
    expect(apply).toContain("resolve every task's annotated worker")
    expect(apply).toContain("missing worker stops the stage before spawning")
    expect(propose).toContain("never substitute the lead or an obsolete generic agent name")
    expect(propose).not.toContain("or use `fullstack-engineer`")
    expect(propose).not.toContain("basic-engineer")
  })

  it("keeps optional optimization guidance behind markers", () => {
    const apply = skill("ob-plan-apply")

    expect(apply).toContain("<!-- OB-OPTIMIZATION-CODEGRAPH-START -->")
    expect(apply).toContain("<!-- OB-OPTIMIZATION-MEMORY-START -->")
    expect(apply).not.toContain("codegraph_explore")
    expect(apply).not.toContain("Agentmemory")
  })

  it("keeps phase procedures with their owning skills", () => {
    const goal = skill("ob-plan-goal")
    const apply = skill("ob-plan-apply")
    const archive = skill("ob-plan-archive")

    expect(goal).toContain("every task complete and `VERIFIED`")
    expect(goal).toContain("Require `ARCHIVED_OK` and the archive path")
    expect(apply).toContain("Every command must exit 0")
    expect(archive).toContain("run the archive once more and repeat the check")
    expect(goal).toContain("then load `ob-repo-verify`")
  })

  it("keeps plan-goal as a compact orchestrator", () => {
    const goal = skill("ob-plan-goal")
    const output = skill("ob-plan-goal", "output.md")

    expect(goal.split("\n").length).toBeLessThan(120)
    expect(goal).toContain("Follow the [branching procedure](branching.md)")
    expect(goal).toContain("Follow the [output procedure](output.md)")
    expect(output).toContain("## Final report")
  })

  it("keeps temporary artifacts inside the repository", () => {
    const guardrails = skill("ob-guardrails-generic")
    const evidence = skill("ob-ops-evidence")

    expect(guardrails).toContain("$REPO_ROOT/.opencode/.tmp/")
    expect(evidence).toContain("capturePlan")
  })

  it("requires evidence skill to write capturePlan and scaffold to be deprecated", () => {
    const scaffold = skill("ob-make-evidence-scaffold")
    const evidence = skill("ob-ops-evidence")

    expect(scaffold).toContain("DEPRECATED")
    expect(evidence).toContain("capturePlan")
    expect(evidence).toContain("Visual Evidence CI workflow")
  })
})
