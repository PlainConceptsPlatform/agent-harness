// pc-subagent-monitor: tracks spawned subagents in .opencode/harness-run.json for
// live TUI display and crash recovery, and holds a wave to agents.maxConcurrent.
//
// It throws in exactly one case: to deny a spawn over the cap. Every other
// failure, including its own bugs, is swallowed — a monitor that breaks the run
// it is watching is worse than no monitor.

import fs from "node:fs/promises"
import path from "node:path"

// A spawn that has been allowed but whose session has not appeared yet. A wave
// is one assistant turn, and opencode calls tool.execute.before for every
// task() in that turn before the first child session exists, so counting live
// sessions alone would let an entire wave through whatever the cap says.
//
// The slot is released when the session lands, and expires otherwise:
// tool.execute.after never fires for a tool that threw, so a failed spawn must
// not hold a slot for the rest of the run.
const PENDING_TTL_MS = 15_000

export const PcSubagentMonitor = async ({ directory, client }) => {
  const root = directory || process.cwd()
  const statePath = path.join(root, ".opencode", "harness-run.json")
  const state = { updatedAt: null, agents: {} }
  const pending = []

  try {
    const prev = JSON.parse(await fs.readFile(statePath, "utf-8"))
    if (prev?.agents && typeof prev.agents === "object") {
      for (const [id, entry] of Object.entries(prev.agents)) {
        if (entry?.status === "running") entry.stale = true
        state.agents[id] = entry
      }
    }
  } catch {
    // fresh start
  }

  let _modelsCache = null
  async function loadModels() {
    if (_modelsCache) return _modelsCache
    const result = { build: null, fast: null, plan: null }
    for (const file of ["harness.user.json", "harness.json"]) {
      try {
        const raw = await fs.readFile(path.join(root, ".opencode", file), "utf-8")
        const { models = {} } = JSON.parse(raw)
        for (const tier of ["build", "fast", "plan"]) {
          if (!result[tier] && models[tier]) result[tier] = models[tier]
        }
      } catch {
        continue
      }
    }
    _modelsCache = result
    return result
  }

  async function modelForAgent(agent) {
    if (!agent) return null
    const dotIdx = agent.lastIndexOf(".")
    const tier = dotIdx !== -1 ? agent.slice(dotIdx + 1) : null
    if (tier && ["build", "fast", "plan"].includes(tier)) {
      const models = await loadModels()
      return models[tier] ?? null
    }
    return null
  }

  function parseTasks(title) {
    if (!title) return []
    const m = /^\s*([\d]+(?:\.[\d]+)*(?:\s*,\s*[\d]+(?:\.[\d]+)*)*)/.exec(title)
    return m ? m[1].split(",").map(s => s.trim()) : []
  }

  // Debounced persist: coalesce rapid writes when multiple subagents spawn
  // in the same microtask batch (e.g. a wave of 5 task() calls).
  let _persistScheduled = false
  async function persist() {
    if (_persistScheduled) return
    _persistScheduled = true
    queueMicrotask(async () => {
      _persistScheduled = false
      state.updatedAt = new Date().toISOString()
      try {
        await fs.mkdir(path.dirname(statePath), { recursive: true })
        const tmpPath = `${statePath}.tmp`
        await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), "utf-8")
        await fs.rename(tmpPath, statePath)
      } catch {
        // best-effort
      }
    })
  }

  function sessionInfo(props) {
    const info = props?.info ?? props ?? {}
    return {
      id: info.id ?? info.sessionID ?? props?.sessionID,
      parentID: info.parentID ?? info.parentId,
      agent: info.agent,
      title: info.title,
    }
  }

  function pruneStale() {
    for (const [id, entry] of Object.entries(state.agents)) {
      if (entry?.stale) delete state.agents[id]
    }
  }

  let _capCache = null
  async function maxConcurrent() {
    if (_capCache) return _capCache
    let configured = 3
    try {
      const raw = await fs.readFile(path.join(root, ".opencode", "harness.json"), "utf-8")
      const value = JSON.parse(raw)?.agents?.maxConcurrent
      if (Number.isFinite(value)) configured = value
    } catch {
      // no config yet; the CLI's own default is 3
    }
    _capCache = Math.min(5, Math.max(1, Math.trunc(configured)))
    return _capCache
  }

  function runningFor(parentID) {
    return Object.values(state.agents)
      .filter(entry => entry?.status === "running" && !entry.stale && entry.parentID === parentID)
      .length
  }

  function livePending(parentID) {
    const now = Date.now()
    for (let i = pending.length - 1; i >= 0; i--) {
      if (now - pending[i].at > PENDING_TTL_MS) pending.splice(i, 1)
    }
    return pending.filter(entry => entry.parentID === parentID).length
  }

  function releasePending(parentID) {
    const index = pending.findIndex(entry => entry.parentID === parentID)
    if (index !== -1) pending.splice(index, 1)
  }

  return {
    // The cap was prose in pc-plan-apply ("you enforce the cap"), which asked
    // the lead to count its own parallel calls. Six disjoint groups and a cap
    // of three is exactly the moment a model stops counting.
    "tool.execute.before": async (input) => {
      if (input?.tool !== "task") return

      let cap
      let live
      try {
        pruneStale()
        cap = await maxConcurrent()
        live = runningFor(input.sessionID) + livePending(input.sessionID)
        if (live < cap) {
          pending.push({ parentID: input.sessionID, at: Date.now() })
          return
        }
      } catch (error) {
        // Compute inside the try, deny outside it, so this catch can never
        // swallow the one exception the hook is meant to raise.
        console.error(`[harness] concurrency check failed open: ${error?.message}`)
        return
      }

      throw new Error(
        `[harness] ${live} subagents are already in flight and agents.maxConcurrent is ${cap}.\n` +
        "Collect a running worker before spawning another. A denied spawn is not a failed task: re-issue it in the next wave.",
      )
    },
    event: async ({ event }) => {
      try {
        if (!event?.type?.startsWith("session.")) return
        const info = sessionInfo(event.properties)
        if (!info.id) return

        if (event.type === "session.created" && info.parentID) {
          pruneStale()
          // The spawn this session came from no longer needs its pending slot;
          // the session itself is now what the cap counts.
          releasePending(info.parentID)

          state.agents[info.id] = {
            agent: info.agent ?? null,
            parentID: info.parentID,
            model: await modelForAgent(info.agent),
            tasks: parseTasks(info.title),
            title: info.title ?? null,
            status: "running",
            startedAt: new Date().toISOString(),
            endedAt: null,
          }
          await persist()
          return
        }

        const entry = state.agents[info.id]
        if (!entry) return

        if (event.type === "session.idle" && entry.status === "running") {
          entry.status = "done"
          entry.endedAt = new Date().toISOString()
          await persist()
          client?.tui?.showToast?.({
            body: {
              message: `subagent done: ${entry.title ?? info.id}`,
              variant: "success",
            },
          })
        }
      } catch {
        // monitoring must never disrupt the run
      }
    },
  }
}
