import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PcSubagentTiers } from "./pc-subagent-tiers.js"

let root
let agentsDir

const FULLSTACK = `---
description: Default engineer.
mode: subagent
color: warning
permission:
  edit: allow
---

You are the default engineer.

## Abilities
- Guardrails: @pc-guardrails-generic, @pc-guardrails-project
`

function agent(name) {
  return fs.readFileSync(path.join(agentsDir, name), "utf-8")
}

function frontmatter(name) {
  return agent(name).match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]
}

async function run(cfg = { agent: {} }) {
  const plugin = await PcSubagentTiers({ directory: root })
  await plugin.config(cfg)
  return cfg
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "pc-tiers-"))
  agentsDir = path.join(root, ".opencode", "agents")
  fs.mkdirSync(agentsDir, { recursive: true })
  fs.writeFileSync(
    path.join(root, ".opencode", "harness.json"),
    JSON.stringify({ models: { plan: "p/plan", build: "p/build", fast: "p/fast" } }),
  )
  fs.writeFileSync(path.join(agentsDir, "fullstack-engineer.md"), FULLSTACK)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe("PcSubagentTiers primaries", () => {
  it("generates build and plan from the fullstack body", async () => {
    await run()

    // Both carry the fullstack identity and abilities verbatim, which is how a
    // /make-engineer edit to fullstack reaches the two agents a human uses.
    for (const name of ["build.md", "plan.md"]) {
      expect(agent(name)).toContain("You are the default engineer.")
      expect(agent(name)).toContain("@pc-guardrails-generic")
      expect(frontmatter(name)).toContain("mode: primary")
    }
  })

  it("takes each primary's model from its matching tier", async () => {
    await run()

    expect(frontmatter("build.md")).toContain("model: p/build")
    expect(frontmatter("plan.md")).toContain("model: p/plan")
  })

  it("denies edit on plan and allows it on build", async () => {
    await run()

    expect(frontmatter("plan.md")).toContain("edit: deny")
    expect(frontmatter("build.md")).toContain("edit: allow")
  })

  it("leaves plan able to read, shell out and spawn engineers", async () => {
    await run()

    // Denying these would break the planning skills, which read git and
    // openspec state and then spawn specialists.
    const fm = frontmatter("plan.md")
    for (const key of ["bash", "read", "grep", "task", "skill"]) {
      expect(fm).toContain(`${key}: allow`)
    }
  })

  it("overrides the built-in build and plan in config", async () => {
    const cfg = await run({ agent: { build: { disable: true }, plan: { disable: true } } })

    expect(cfg.agent.build.mode).toBe("primary")
    expect(cfg.agent.plan.mode).toBe("primary")
    expect(cfg.agent.build.model).toBe("p/build")
    expect(cfg.agent.plan.permission.edit).toBe("deny")
  })

  it("gives build and plan their reserved theme colours", async () => {
    await run()

    expect(frontmatter("build.md")).toContain("color: primary")
    expect(frontmatter("plan.md")).toContain("color: warning")
  })

  it("skips the primaries when fullstack-engineer.md is absent", async () => {
    fs.rmSync(path.join(agentsDir, "fullstack-engineer.md"))

    await run()

    expect(fs.existsSync(path.join(agentsDir, "build.md"))).toBe(false)
    expect(fs.existsSync(path.join(agentsDir, "plan.md"))).toBe(false)
  })
})

describe("PcSubagentTiers engineer templates", () => {
  it("rewrites a primary engineer to subagent on disk", async () => {
    fs.writeFileSync(
      path.join(agentsDir, "frontend-engineer.md"),
      "---\ndescription: Frontend.\nmode: primary\nmodel: stale/model\n---\n\nYou are a frontend engineer.\n\n## Abilities\n- Guardrails: @pc-guardrails-generic\n",
    )

    await run()

    const fm = frontmatter("frontend-engineer.md")
    expect(fm).toContain("mode: subagent")
    expect(fm).not.toContain("mode: primary")
    // A template must never pin a model; tiers own that.
    expect(fm).not.toContain("model:")
  })

  it("normalizes a fullstack left as primary by an earlier version", async () => {
    fs.writeFileSync(
      path.join(agentsDir, "fullstack-engineer.md"),
      FULLSTACK.replace("mode: subagent", "mode: primary"),
    )

    await run()

    expect(frontmatter("fullstack-engineer.md")).toContain("mode: subagent")
    // ...and the primaries still come out primary.
    expect(frontmatter("build.md")).toContain("mode: primary")
  })

  it("still writes one tier variant per engineer as a subagent", async () => {
    fs.writeFileSync(
      path.join(agentsDir, "frontend-engineer.md"),
      "---\ndescription: Frontend.\nmode: subagent\n---\n\nYou are a frontend engineer.\n\n## Abilities\n- Guardrails: @pc-guardrails-generic\n",
    )

    await run()

    for (const tier of ["build", "fast", "plan"]) {
      const fm = frontmatter(`frontend-engineer.${tier}.md`)
      expect(fm).toContain("mode: subagent")
      expect(fm).toContain(`model: p/${tier}`)
    }
  })

  it("replaces a hand-picked theme colour with the derived hex", async () => {
    fs.writeFileSync(
      path.join(agentsDir, "frontend-engineer.md"),
      "---\ndescription: Frontend.\nmode: subagent\ncolor: info\n---\n\nYou are a frontend engineer.\n",
    )

    await run()

    const fm = frontmatter("frontend-engineer.md")
    expect(fm).not.toContain("color: info")
    expect(fm).toMatch(/color: #[0-9A-F]{6}/)
  })

  it("leaves a deliberate hex alone", async () => {
    fs.writeFileSync(
      path.join(agentsDir, "frontend-engineer.md"),
      "---\ndescription: Frontend.\nmode: subagent\ncolor: #123456\n---\n\nYou are a frontend engineer.\n",
    )

    await run()

    expect(frontmatter("frontend-engineer.md")).toContain("color: #123456")
  })

  it("adds a colour when the template has none", async () => {
    fs.writeFileSync(
      path.join(agentsDir, "butterfly-engineer.md"),
      "---\ndescription: Butterfly.\nmode: subagent\n---\n\nYou are a butterfly engineer.\n",
    )

    await run()

    expect(frontmatter("butterfly-engineer.md")).toMatch(/color: #[0-9A-F]{6}/)
  })

  it("does not generate tier variants for fullstack itself", async () => {
    await run()

    expect(fs.existsSync(path.join(agentsDir, "fullstack-engineer.build.md"))).toBe(false)
  })
})
