import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// OpenCode 2 plugin API. define() hands the definition straight back, so the
// test drives setup() with a hand-made context.
vi.mock("@opencode/plugin", () => ({ Plugin: { define: definition => definition } }))

import PcSubagentTiers from "./pc-subagent-tiers.js"

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

async function run(ctx = {}) {
  await PcSubagentTiers.setup({
    location: { directory: root },
    agent: { transform: async () => ({ dispose() {} }), reload: async () => {} },
    ...ctx,
  })
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

  it("denies edit and subagent on plan", async () => {
    await run()

    const fm = frontmatter("plan.md")
    expect(fm).toContain("permissions:")
    expect(fm).toMatch(/- action: edit[\s\S]*?- action: subagent/)
    expect(fm.match(/effect: deny/g)?.length).toBe(2)
    // shell stays allowed: the planning skills read git and openspec state.
    expect(fm).not.toContain("action: shell")
  })

  it("leaves build unrestricted by an explicit deny", async () => {
    await run()
    expect(frontmatter("build.md")).not.toContain("effect: deny")
  })

  it("gives build and plan their reserved theme colours", async () => {
    await run()

    expect(frontmatter("build.md")).toContain("color: primary")
    expect(frontmatter("plan.md")).toContain("color: warning")
  })

  it("generates planner on the plan tier, selectable and spawnable, able to edit but not spawn", async () => {
    await run()

    const fm = frontmatter("planner.md")
    expect(agent("planner.md")).toContain("You are the default engineer.")
    expect(fm).toContain("mode: all")
    expect(fm).toContain("model: p/plan")
    expect(fm).toMatch(/- action: subagent\s+resource: \*\s+effect: deny/)
    expect(fm).not.toContain("action: edit")
  })

  it("skips the primaries when fullstack-engineer.md is absent", async () => {
    fs.rmSync(path.join(agentsDir, "fullstack-engineer.md"))

    await run()

    expect(fs.existsSync(path.join(agentsDir, "build.md"))).toBe(false)
    expect(fs.existsSync(path.join(agentsDir, "plan.md"))).toBe(false)
  })
})

describe("PcSubagentTiers engineer templates", () => {
  it("rewrites a primary engineer to subagent and strips legacy model", async () => {
    fs.writeFileSync(
      path.join(agentsDir, "frontend-engineer.md"),
      "---\ndescription: Frontend.\nmode: primary\nmodel: stale/model\npermission:\n  edit: allow\n---\n\nYou are a frontend engineer.\n\n## Abilities\n- Guardrails: @pc-guardrails-generic\n",
    )

    await run()

    const fm = frontmatter("frontend-engineer.md")
    expect(fm).toContain("mode: subagent")
    expect(fm).not.toContain("mode: primary")
    expect(fm).not.toContain("model:")
    expect(fm).not.toContain("permission:")
  })

  it("normalizes a fullstack left as primary by an earlier version", async () => {
    fs.writeFileSync(
      path.join(agentsDir, "fullstack-engineer.md"),
      FULLSTACK.replace("mode: subagent", "mode: primary"),
    )

    await run()

    expect(frontmatter("fullstack-engineer.md")).toContain("mode: subagent")
    expect(frontmatter("build.md")).toContain("mode: primary")
  })

  it("writes one tier variant per engineer as a subagent", async () => {
    fs.writeFileSync(
      path.join(agentsDir, "frontend-engineer.md"),
      "---\ndescription: Frontend.\nmode: subagent\n---\n\nYou are a frontend engineer.\n\n## Abilities\n- Guardrails: @pc-guardrails-generic\n",
    )

    await run()

    for (const tier of ["build", "fast", "plan"]) {
      const fm = frontmatter(`frontend-engineer.${tier}.md`)
      expect(fm).toContain("mode: subagent")
      expect(fm).toContain(`model: p/${tier}`)
      // Tier variants are chosen by the task author, not picked from the @ menu.
      expect(fm).toContain("hidden: true")
    }
  })

  it("replaces a hand-picked theme colour with a quoted derived hex", async () => {
    fs.writeFileSync(
      path.join(agentsDir, "frontend-engineer.md"),
      "---\ndescription: Frontend.\nmode: subagent\ncolor: info\n---\n\nYou are a frontend engineer.\n",
    )

    await run()

    const fm = frontmatter("frontend-engineer.md")
    expect(fm).not.toContain("color: info")
    expect(fm).toMatch(/color: "#[0-9A-F]{6}"/)
  })

  it("repairs an unquoted hex left by an earlier version", async () => {
    fs.writeFileSync(
      path.join(agentsDir, "frontend-engineer.md"),
      "---\ndescription: Frontend.\nmode: subagent\ncolor: #C431D8\n---\n\nYou are a frontend engineer.\n",
    )

    await run()

    expect(frontmatter("frontend-engineer.md")).toContain('color: "#C431D8"')
  })

  it("does not generate tier variants for fullstack itself", async () => {
    await run()
    expect(fs.existsSync(path.join(agentsDir, "fullstack-engineer.build.md"))).toBe(false)
  })
})
