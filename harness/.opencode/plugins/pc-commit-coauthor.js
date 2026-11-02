// pc-commit-coauthor: every commit an OpenCode agent makes names OpenCode as a
// co-author, so agent work stays identifiable in history and in the metrics
// built from it.
//
// The rule is enforced, not requested. `tool.execute.before` rewrites the shell
// tool's command before it runs (and before the permission check sees it):
// each `git commit` gains a `--trailer`, which git folds into the message
// however it was written (`-m`, `-F`, an editor, `--amend`). It fails open: a
// bug here leaves the command as the agent wrote it.

import { Plugin } from "@opencode/plugin"

export const TRAILER = "Co-Authored-By: opencode <noreply@opencode.ai>"

const SHELL_TOOL = "shell"

// `git commit` at the start of the command or of any segment, after git's own
// `-C <path>` / `-c <key=value>` options. `commit-tree` and `commit-graph` are
// other commands and do not match.
const GIT_COMMIT = /(^|[;&|\n({`])(\s*git(?:\s+-[Cc]\s+(?:"[^"]*"|'[^']*'|[^\s"']+)+)*\s+commit)(?![\w-])/g

export function withTrailer(command) {
  if (typeof command !== "string" || command.includes("noreply@opencode.ai")) return command
  return command.replace(GIT_COMMIT, (_, before, commit) => `${before}${commit} --trailer "${TRAILER}"`)
}

export default Plugin.define({
  id: "pc.commit-coauthor",
  async setup(ctx) {
    await ctx.tool.hook("execute.before", event => {
      try {
        if (event.tool !== SHELL_TOOL) return
        const command = event.input?.command
        const next = withTrailer(command)
        if (next !== command) event.input = { ...event.input, command: next }
      } catch (error) {
        console.error(`[harness] commit co-author hook failed open: ${error?.message}`)
      }
    })
  },
})
