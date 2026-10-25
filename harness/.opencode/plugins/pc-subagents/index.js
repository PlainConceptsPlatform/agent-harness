// pc-subagents: holds a spawn wave to agents.maxConcurrent and keeps a
// live record of child sessions in .opencode/harness-run.json.
//
// OpenCode 2 denies through the permission system, not by throwing from a tool
// hook, so the cap is a `subagent` permission rule: an `evaluate` hook counts
// the children of the asking session and denies the launch over the limit.
//
// Child sessions are observed from the event stream. V2 does not document the
// event type strings (the payload schema is an opaque `string`), so the handler
// is deliberately tolerant and, with PC_HARNESS_DEBUG set, prints every event
// type once so the names can be pinned from a real run. Counting via the event
// stream is the iteration-one mechanism; `ctx.session` in the plugin context is
// not documented to expose `list`, so it is not used here.

import { Plugin } from "@opencode/plugin"
import fs from "node:fs/promises"
import path from "node:path"

const PENDING_TTL_MS = 15_000

export default Plugin.define({
  id: "pc.subagents",
  async setup(ctx) {
    const root = ctx.location.directory || process.cwd()
    const statePath = path.join(root, ".opencode", "harness-run.json")
    const state = { updatedAt: null, agents: {} }
    const pending = []
    const seenTypes = new Set()
    let capCache = null

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

    let persistScheduled = false
    function persist() {
      if (persistScheduled) return
      persistScheduled = true
      queueMicrotask(async () => {
        persistScheduled = false
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

    function pruneStale() {
      for (const [id, entry] of Object.entries(state.agents)) {
        if (entry?.stale) delete state.agents[id]
      }
    }

    async function maxConcurrent() {
      if (capCache) return capCache
      let configured = 3
      try {
        const raw = await fs.readFile(path.join(root, ".opencode", "harness.json"), "utf-8")
        const value = JSON.parse(raw)?.agents?.maxConcurrent
        if (Number.isFinite(value)) configured = value
      } catch {
        // no config yet; the CLI's own default is 3
      }
      capCache = Math.min(5, Math.max(1, Math.trunc(configured)))
      return capCache
    }

    let modelsCache = {}
    async function loadModels() {
      const result = {}
      for (const file of ["harness.user.json", "harness.json"]) {
        try {
          const raw = await fs.readFile(path.join(root, ".opencode", file), "utf-8")
          const { models = {} } = JSON.parse(raw)
          for (const [tier, model] of Object.entries(models)) {
            if (model && !result[tier]) result[tier] = model
          }
        } catch {
          continue
        }
      }
      modelsCache = result
      return result
    }

    // The sidebar shows which model a tier-variant agent actually runs on. The
    // cache is warmed in setup, so the event path stays synchronous: awaiting a
    // file read here delays the running state past the point the cap reads it.
    function modelForAgent(agent) {
      if (!agent) return null
      const dotIdx = agent.lastIndexOf(".")
      const tier = dotIdx !== -1 ? agent.slice(dotIdx + 1) : null
      return tier ? modelsCache[tier] ?? null : null
    }

    // Task ids arrive in the session title ("2.1, 2.2: ..."), which is the only
    // place the TUI can show what a worker is actually doing.
    function parseTasks(title) {
      if (!title) return []
      const match = /^\s*([\d]+(?:\.[\d]+)*(?:\s*,\s*[\d]+(?:\.[\d]+)*)*)/.exec(title)
      return match ? match[1].split(",").map(value => value.trim()) : []
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

    // The cap was prose in pc-plan-apply ("you enforce the cap"), which asked the
    // lead to count its own parallel calls. Six disjoint groups and a cap of
    // three is exactly the moment a model stops counting.
    await ctx.permission.hook("evaluate", async event => {
      if (event.action !== "subagent") return
      let cap
      let live
      try {
        pruneStale()
        cap = await maxConcurrent()
        live = runningFor(event.sessionID) + livePending(event.sessionID)
        if (live < cap) {
          pending.push({ parentID: event.sessionID, at: Date.now() })
          return
        }
      } catch (error) {
        console.error(`[harness] concurrency check failed open: ${error?.message}`)
        return
      }
      deny(event, live, cap)
    })

    function deny(event, live, cap) {
      event.effect = "deny"
      event.message =
        `[harness] ${live} subagents are already in flight and agents.maxConcurrent is ${cap}.\n` +
        "Collect a running worker before spawning another. A denied spawn is not a failed task: re-issue it in the next wave."
    }

    function extractSession(event) {
      const data = event?.data ?? event?.properties ?? event ?? {}
      const info = data?.info ?? data?.session ?? data ?? {}
      const id = info.id ?? info.sessionID ?? data.sessionID
      const parentID = info.parentID ?? info.parentId ?? data.parentID
      const status = info.status ?? data.status
      return { id, parentID, agent: info.agent ?? null, title: info.title ?? null, status }
    }

    await loadModels()

    const controller = new AbortController()
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          try {
            const type = String(event?.type ?? "")
            if (process.env.PC_HARNESS_DEBUG && type && !seenTypes.has(type)) {
              seenTypes.add(type)
              console.error(`[pc-subagents] event: ${type}`)
            }
            const { id, parentID, agent, title, status } = extractSession(event)
            if (!id || !parentID) continue

            if (status === "running" || /created|started/.test(type)) {
              pruneStale()
              releasePending(parentID)
              state.agents[id] = {
                agent,
                model: modelForAgent(agent),
                tasks: parseTasks(title),
                parentID,
                title,
                status: "running",
                startedAt: new Date().toISOString(),
                endedAt: null,
              }
              await persist()
              continue
            }

            const entry = state.agents[id]
            if (!entry) continue
            if (status === "idle" || /idle|completed|succeeded|failed/.test(type)) {
              entry.status = "done"
              entry.endedAt = new Date().toISOString()
              await persist()
            }
          } catch {
            // monitoring must never disrupt the run
          }
        }
      } catch {
        // stream aborted on unload
      }
    })()

    return () => controller.abort()
  },
})
