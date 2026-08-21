// pc-subagent-monitor: tracks spawned subagents in .opencode/harness-run.json for
// live TUI display and crash recovery. Never throws: monitor failures must
// not break a session.

import fs from "node:fs/promises"
import path from "node:path"

export const PcSubagentMonitor = async ({ directory, client }) => {
  const root = directory || process.cwd()
  const statePath = path.join(root, ".opencode", "harness-run.json")
  const state = { updatedAt: null, agents: {} }

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

  return {
    event: async ({ event }) => {
      try {
        if (!event?.type?.startsWith("session.")) return
        const info = sessionInfo(event.properties)
        if (!info.id) return

        if (event.type === "session.created" && info.parentID) {
          pruneStale()

          state.agents[info.id] = {
            agent: info.agent ?? null,
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
