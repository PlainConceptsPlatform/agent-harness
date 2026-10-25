import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@opencode/plugin", () => ({ Plugin: { define: definition => definition } }))

import PcSubagentMonitor from "./index.js"

let root
let hooks
let stream
const LEAD = "ses_lead"

function makeStream() {
  const queue = []
  let waiter = null
  return {
    push(event) {
      if (waiter) {
        const resolve = waiter
        waiter = null
        resolve({ value: event, done: false })
      } else {
        queue.push(event)
      }
    },
    [Symbol.asyncIterator]() {
      return {
        next: () =>
          queue.length > 0
            ? Promise.resolve({ value: queue.shift(), done: false })
            : new Promise(resolve => {
                waiter = resolve
              }),
      }
    },
  }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

async function load(maxConcurrent) {
  fs.mkdirSync(path.join(root, ".opencode"), { recursive: true })
  if (maxConcurrent !== undefined) {
    fs.writeFileSync(
      path.join(root, ".opencode", "harness.json"),
      JSON.stringify({ agents: { maxConcurrent } }),
    )
  }
  hooks = {}
  stream = makeStream()
  await PcSubagentMonitor.setup({
    location: { directory: root },
    permission: { hook: (name, cb) => { hooks[name] = cb; return Promise.resolve({ dispose() {} }) } },
    event: { subscribe: () => stream },
  })
}

async function spawn(sessionID = LEAD) {
  const event = { action: "subagent", sessionID, resources: ["backend-engineer"], effect: "allow" }
  await hooks.evaluate(event)
  return event
}

async function created(parentID = LEAD, id = `ses_child_${Math.random().toString(36).slice(2)}`) {
  stream.push({ type: "session.created", data: { info: { id, parentID, agent: "backend-engineer.build" } } })
  await flush()
  return id
}

async function idle(id) {
  stream.push({ type: "session.idle", data: { info: { id, parentID: LEAD } } })
  await flush()
}

async function stateFile() {
  const file = path.join(root, ".opencode", "harness-run.json")
  for (let i = 0; i < 50; i++) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf-8"))
    } catch {
      await new Promise(resolve => setTimeout(resolve, 20))
    }
  }
  throw new Error("harness-run.json was never written")
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "pc-monitor-"))
})

afterEach(async () => {
  // The plugin persists run state in a queued microtask, so a write can land
  // just as cleanup starts. Give it a moment, then retry on Windows.
  await new Promise(resolve => setTimeout(resolve, 250))
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 })
})

describe("the wave cap", () => {
  it("allows up to the cap and denies the next spawn", async () => {
    await load(3)

    for (let i = 0; i < 3; i++) {
      expect((await spawn()).effect).toBe("allow")
      await created()
    }

    const denied = await spawn()
    expect(denied.effect).toBe("deny")
    expect(denied.message).toContain("agents.maxConcurrent is 3")
  })

  it("counts spawns that are still in flight", async () => {
    await load(2)

    expect((await spawn()).effect).toBe("allow")
    expect((await spawn()).effect).toBe("allow")
    const denied = await spawn()
    expect(denied.effect).toBe("deny")
    expect(denied.message).toContain("2 subagents are already in flight")
  })

  it("does not double-count a spawn once its session appears", async () => {
    await load(2)

    await spawn()
    await created()
    expect((await spawn()).effect).toBe("allow")
  })

  it("frees a slot when a worker goes idle", async () => {
    await load(1)

    await spawn()
    const child = await created()
    expect((await spawn()).effect).toBe("deny")

    await idle(child)
    expect((await spawn()).effect).toBe("allow")
  })

  it("counts each lead's own children", async () => {
    await load(1)

    await spawn(LEAD)
    await created(LEAD)

    expect((await spawn("ses_other")).effect).toBe("allow")
    expect((await spawn(LEAD)).effect).toBe("deny")
  })

  it("ignores running entries left by a crashed run", async () => {
    await load(2)
    fs.writeFileSync(
      path.join(root, ".opencode", "harness-run.json"),
      JSON.stringify({
        agents: {
          ses_ghost_a: { parentID: LEAD, status: "running" },
          ses_ghost_b: { parentID: LEAD, status: "running" },
        },
      }),
    )
    await load(2)

    expect((await spawn()).effect).toBe("allow")
  })

  it("clamps the configured cap to 1..5", async () => {
    await load(99)

    for (let i = 0; i < 5; i++) {
      expect((await spawn()).effect).toBe("allow")
    }
    expect((await spawn()).effect).toBe("deny")
  })

  it("falls back to 3 with no config", async () => {
    await load()

    for (let i = 0; i < 3; i++) {
      expect((await spawn()).effect).toBe("allow")
    }
    expect((await spawn()).message).toContain("agents.maxConcurrent is 3")
  })
})

describe("it changes nothing for anything else", () => {
  beforeEach(() => load(2))

  it("ignores every action but subagent", async () => {
    for (const action of ["shell", "edit", "read", "skill"]) {
      for (let i = 0; i < 10; i++) {
        const event = { action, sessionID: LEAD, resources: ["x"], effect: "allow" }
        await hooks.evaluate(event)
        expect(event.effect).toBe("allow")
      }
    }
  })

  it("survives malformed payloads", async () => {
    const malformed = { action: "subagent", effect: "allow" }
    await hooks.evaluate(malformed)
    // No sessionID: nothing to count against, so the spawn proceeds.
    expect(malformed.effect).toBe("allow")
  })

  it("survives unreadable config", async () => {
    fs.writeFileSync(path.join(root, ".opencode", "harness.json"), "{ not json")
    await load(undefined)
    fs.writeFileSync(path.join(root, ".opencode", "harness.json"), "{ not json")

    expect((await spawn()).effect).toBe("allow")
  })
})

describe("the sidebar payload", () => {
  it("records the tier model and the task ids from the session", async () => {
    fs.mkdirSync(path.join(root, ".opencode"), { recursive: true })
    fs.writeFileSync(
      path.join(root, ".opencode", "harness.json"),
      JSON.stringify({ models: { build: "anthropic/claude-sonnet-4" } }),
    )
    await load()

    stream.push({
      type: "session.created",
      data: {
        info: {
          id: "ses_task",
          parentID: LEAD,
          agent: "backend-engineer.build",
          title: "2.1, 2.2: Wave two",
        },
      },
    })
    await flush()

    const state = await stateFile()
    expect(state.agents.ses_task.model).toBe("anthropic/claude-sonnet-4")
    expect(state.agents.ses_task.tasks).toEqual(["2.1", "2.2"])
  })

  it("leaves the model empty for an agent with no tier suffix", async () => {
    await load()
    await created(LEAD, "ses_plain")

    const state = await stateFile()
    expect(state.agents.ses_plain.model).toBeNull()
  })
})
