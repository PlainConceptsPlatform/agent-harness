import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PcSubagentMonitor } from "./pc-subagent-monitor.js"

// The cap is the only rule this plugin enforces, and the one thing it may
// throw for. Everything else here proves it does not throw: a monitor that
// breaks the run it is watching is worse than no monitor.

let root
let plugin
const LEAD = "ses_lead"

function harness(maxConcurrent) {
  fs.mkdirSync(path.join(root, ".opencode"), { recursive: true })
  fs.writeFileSync(
    path.join(root, ".opencode", "harness.json"),
    JSON.stringify({ agents: { maxConcurrent } }),
  )
}

const spawn = (sessionID = LEAD) =>
  plugin["tool.execute.before"]({ tool: "task", sessionID, callID: "c1" })

let nextChild = 0
const created = (parentID = LEAD) => {
  const id = `ses_child_${++nextChild}`
  return plugin
    .event({ event: { type: "session.created", properties: { info: { id, parentID, agent: "backend-engineer.build", title: "1.1 work" } } } })
    .then(() => id)
}

const idle = id => plugin.event({ event: { type: "session.idle", properties: { info: { id } } } })

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "pc-monitor-"))
  nextChild = 0
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe("the wave cap", () => {
  it("allows up to the cap and denies the next spawn", async () => {
    harness(3)
    plugin = await PcSubagentMonitor({ directory: root })

    for (let i = 0; i < 3; i++) {
      await expect(spawn()).resolves.toBeUndefined()
      await created()
    }

    await expect(spawn()).rejects.toThrow("agents.maxConcurrent is 3")
  })

  // A wave is one assistant turn: every task() in it reaches this hook before
  // the first child session exists. Counting live sessions only would let the
  // whole wave through, which is the failure the cap exists to prevent.
  it("counts spawns that are still in flight", async () => {
    harness(2)
    plugin = await PcSubagentMonitor({ directory: root })

    await expect(spawn()).resolves.toBeUndefined()
    await expect(spawn()).resolves.toBeUndefined()
    await expect(spawn()).rejects.toThrow("2 subagents are already in flight")
  })

  it("does not double-count a spawn once its session appears", async () => {
    harness(2)
    plugin = await PcSubagentMonitor({ directory: root })

    await spawn()
    await created()
    // The pending slot was released, so the session is the only thing counted.
    await expect(spawn()).resolves.toBeUndefined()
  })

  it("frees a slot when a worker goes idle", async () => {
    harness(1)
    plugin = await PcSubagentMonitor({ directory: root })

    await spawn()
    const child = await created()
    await expect(spawn()).rejects.toThrow("agents.maxConcurrent is 1")

    await idle(child)
    await expect(spawn()).resolves.toBeUndefined()
  })

  it("counts each lead's own children", async () => {
    harness(1)
    plugin = await PcSubagentMonitor({ directory: root })

    await spawn(LEAD)
    await created(LEAD)

    // Another session at its cap says nothing about this one.
    await expect(spawn("ses_other")).resolves.toBeUndefined()
    await expect(spawn(LEAD)).rejects.toThrow("already in flight")
  })

  // Ghost entries from a crashed run are marked stale on load. Without the
  // prune they would refuse the first spawns of the next run.
  it("ignores running entries left by a crashed run", async () => {
    harness(2)
    fs.writeFileSync(
      path.join(root, ".opencode", "harness-run.json"),
      JSON.stringify({
        agents: {
          ses_ghost_a: { parentID: LEAD, status: "running" },
          ses_ghost_b: { parentID: LEAD, status: "running" },
        },
      }),
    )
    plugin = await PcSubagentMonitor({ directory: root })

    await expect(spawn()).resolves.toBeUndefined()
  })

  it("clamps the configured cap to 1..5", async () => {
    harness(99)
    plugin = await PcSubagentMonitor({ directory: root })

    for (let i = 0; i < 5; i++) {
      await expect(spawn()).resolves.toBeUndefined()
    }
    await expect(spawn()).rejects.toThrow("agents.maxConcurrent is 5")
  })

  it("falls back to 3 with no config", async () => {
    plugin = await PcSubagentMonitor({ directory: root })

    for (let i = 0; i < 3; i++) {
      await expect(spawn()).resolves.toBeUndefined()
    }
    await expect(spawn()).rejects.toThrow("agents.maxConcurrent is 3")
  })
})

describe("it does not throw for anything else", () => {
  beforeEach(async () => {
    harness(2)
    plugin = await PcSubagentMonitor({ directory: root })
  })

  it("ignores every tool but task", async () => {
    for (const tool of ["bash", "edit", "write", "skill"]) {
      for (let i = 0; i < 10; i++) {
        await expect(
          plugin["tool.execute.before"]({ tool, sessionID: LEAD, callID: "c" }),
        ).resolves.toBeUndefined()
      }
    }
  })

  it("survives a malformed hook payload", async () => {
    await expect(plugin["tool.execute.before"](undefined)).resolves.toBeUndefined()
    await expect(plugin["tool.execute.before"]({})).resolves.toBeUndefined()
    // No sessionID: nothing to count against, so the spawn proceeds.
    await expect(plugin["tool.execute.before"]({ tool: "task" })).resolves.toBeUndefined()
  })

  it("survives unreadable config and malformed events", async () => {
    fs.writeFileSync(path.join(root, ".opencode", "harness.json"), "{ not json")
    plugin = await PcSubagentMonitor({ directory: root })

    await expect(spawn()).resolves.toBeUndefined()
    await expect(plugin.event({ event: { type: "session.created" } })).resolves.toBeUndefined()
    await expect(plugin.event({ event: {} })).resolves.toBeUndefined()
    await expect(plugin.event({})).resolves.toBeUndefined()
  })
})
