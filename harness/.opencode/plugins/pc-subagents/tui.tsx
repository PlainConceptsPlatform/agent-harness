/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { createSignal, For, Show } from "solid-js"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

type Row = { id: string; agent: string; model: string; task: string; status: string }

// Renders a live "Subagents" panel in the session sidebar.
//
// Server plugins cannot draw UI; only a plugin's `tui` entry can, by claiming
// a slot. This panel is fed by the `.opencode/harness-run.json` state file that
// the server half (index.js, same directory) maintains, so the two cooperate:
// server half = data producer, this half = renderer.
//
// The claim is additive (`append`). `replace` would take over the whole
// `sidebar.content` boundary and suppress the built-in session list.
export default Plugin.define({
  id: "pc.subagents.panel",
  setup: (ctx) => {
    const statePath = join(ctx.location?.directory ?? process.cwd(), ".opencode", "harness-run.json")
    const [rows, setRows] = createSignal<Row[]>([])
    // Only show live subagents, finished/failed ones are kept in harness-run.json
    // for recovery but are not navigable targets the user cares about here.
    // Entries marked stale (left "running" by a crashed process) are not live.
    const active = () => rows().filter((r) => r.status === "running")

    const refresh = async () => {
      try {
        const data = JSON.parse(await readFile(statePath, "utf-8"))
        const agents = data?.agents ?? {}
        setRows(
          Object.entries(agents)
            .filter(([, a]: [string, any]) => !a?.stale)
            .map(([sid, a]: [string, any]) => ({
              id: sid,
              agent: a?.agent ?? "?",
              model: a?.model ?? "",
              task: Array.isArray(a?.tasks) && a.tasks.length ? a.tasks.join(",") : (a?.title ?? ""),
              status: a?.status ?? "running",
            })),
        )
      } catch (err: any) {
        // Missing file = genuinely idle. Anything else (transient read/parse
        // hiccup) keeps the last good rows instead of flashing "idle" mid-run.
        if (err?.code === "ENOENT") setRows([])
      }
    }

    void refresh()
    // A subagent wave emits a burst of events; debounce so we do not re-read
    // the state file once per event.
    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefresh = () => {
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        void refresh()
      }, 200)
    }

    const cleanups: Array<() => void> = []
    for (const evt of ["session.created", "session.idle", "session.execution.succeeded"]) {
      try {
        cleanups.push(ctx.data.on(evt, scheduleRefresh))
      } catch {
        /* event type unavailable on this host, ignore */
      }
    }

    cleanups.push(
      ctx.ui.slot({
        append: "sidebar.content",
        render: () => (
          <box flexDirection="column">
            <text>Subagents</text>
            <Show when={active().length === 0}>
              <text>  idle</text>
            </Show>
            <For each={active()}>
              {(r) => (
                <box onMouseUp={() => ctx.ui.router.navigate({ type: "session", sessionID: r.id })}>
                  <text>
                    {"▶ "}
                    {r.agent}
                    {r.model ? ` · ${r.model}` : ""}
                    {r.task ? `, ${r.task}` : ""}
                  </text>
                </box>
              )}
            </For>
          </box>
        ),
      }),
    )

    // Return a cleanup so hot reloads don't leak listeners or slot claims.
    return () => {
      for (const dispose of cleanups) dispose()
    }
  },
})
