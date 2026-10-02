import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@opencode/plugin", () => ({ Plugin: { define: definition => definition } }))

import PcSystemReminders from "./pc-system-reminders.js"

let root
let hooks

async function loadPlugin() {
  fs.mkdirSync(path.join(root, ".opencode", "agents"), { recursive: true })
  fs.mkdirSync(path.join(root, ".agents", "skills", "pc-guardrails-generic"), { recursive: true })
  fs.writeFileSync(path.join(root, ".agents", "skills", "pc-guardrails-generic", "SKILL.md"), "# Guardrails\n")
  fs.writeFileSync(
    path.join(root, ".opencode", "agents", "build.md"),
    "---\nmode: primary\n---\n\nBody.\n\n## Abilities\n- Guardrails: @pc-guardrails-generic\n",
  )
  fs.writeFileSync(path.join(root, ".opencode", "harness.json"), JSON.stringify({ platform: { backlog: "github" } }))

  hooks = {}
  await PcSystemReminders.setup({
    location: { directory: root },
    session: { hook: (name, cb) => { hooks[name] = cb; return Promise.resolve({ dispose() {} }) } },
    permission: { hook: (name, cb) => { hooks[name] = cb; return Promise.resolve({ dispose() {} }) } },
  })
}

const contextEvent = (sessionID = "s1", agent = "build") => ({ sessionID, agent, system: [], messages: [] })

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "pc-reminders-"))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe("PcSystemReminders", () => {
  it("reminds an agent to load its abilities before work", async () => {
    await loadPlugin()
    const event = contextEvent()

    await hooks.context(event)

    const text = event.system.map(part => part.text).join("\n")
    expect(text).toContain("system-reminder")
    expect(text).toContain("pc-guardrails-generic")
  })

  it("stops reminding after the required guardrail loads", async () => {
    await loadPlugin()
    await hooks.evaluate({ sessionID: "s1", agent: "build", action: "skill", resources: ["pc-guardrails-generic"], effect: "allow" })

    const event = contextEvent()
    await hooks.context(event)

    const text = event.system.map(part => part.text).join("\n")
    expect(text).not.toContain("Load these required skills")
    // The trust boundary is always stated.
    expect(text).toContain("trusted")
  })
})
