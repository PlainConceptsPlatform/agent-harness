/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createSignal, For, Show } from "solid-js"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

const id = "ob.subagents"

type Row = { id: string; agent: string; model: string; task: string; status: string }

// Renders a live "Subagents" panel in the session sidebar.
//
// Server plugins (opencode.json) cannot draw UI, only TUI plugins (tui.json)
// can, via the `sidebar_content` slot. This panel is fed by the
// `.opencode/harness-run.json` state file that the `pc-subagent-monitor` server
// plugin maintains, so the two cooperate: server plugin = data producer,
// this TUI plugin = renderer.
const tui: TuiPlugin = async (api) => {
  const statePath = join(process.cwd(), ".opencode", "harness-run.json")
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

  await refresh()
  // session.updated fires constantly; debounce so we don't re-read the file
  // on every keystroke-sized event.
  let timer: ReturnType<typeof setTimeout> | null = null
  const scheduleRefresh = () => {
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      void refresh()
    }, 200)
  }
  for (const evt of ["session.created", "session.idle", "session.updated"]) {
    try {
      api.event.on(evt as any, scheduleRefresh)
    } catch {
      /* event type unavailable on this host, ignore */
    }
  }

  api.slots.register({
    order: 50,
    slots: {
      sidebar_content() {
        return (
          <box flexDirection="column">
            <text>Subagents</text>
            <Show when={active().length === 0}>
              <text>  idle</text>
            </Show>
            <For each={active()}>
              {(r) => (
                <box onMouseUp={() => api.route.navigate("session", { sessionID: r.id })}>
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
        )
      },
    },
  })
}

const pluginModule: TuiPluginModule & { id: string } = { id, tui }

export default pluginModule
