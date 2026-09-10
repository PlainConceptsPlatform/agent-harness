import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PcSystemReminders } from "./pc-system-reminders.js"

// The guard turns the harness "never" rules into denied tool calls. A denial
// throws, so every case here asserts on the thrown message; the fail-open
// cases assert that nothing throws at all, which matters more than any single
// rule: a guard that breaks a session over its own bug is worse than the rule.

let root
let plugin
const SESSION = "ses_test"

async function load({ agent = "build", loaded = ["pc-guardrails-generic"], backlog = "github" } = {}) {
  fs.mkdirSync(path.join(root, ".opencode", "agents"), { recursive: true })
  fs.mkdirSync(path.join(root, ".agents", "skills", "pc-guardrails-generic"), { recursive: true })
  fs.writeFileSync(path.join(root, ".agents", "skills", "pc-guardrails-generic", "SKILL.md"), "# Guardrails\n")
  // A tier variant has no file of its own; its skills come from the base agent.
  const base = agent.replace(/\.(?:build|fast|plan)$/, "")
  fs.writeFileSync(
    path.join(root, ".opencode", "agents", `${base}.md`),
    `---\nmode: primary\n---\n\nBody.\n\n## Abilities\n- Guardrails: @pc-guardrails-generic\n`,
  )
  fs.writeFileSync(
    path.join(root, ".opencode", "harness.json"),
    JSON.stringify({ platform: { backlog } }),
  )

  plugin = await PcSystemReminders({ directory: root })
  await plugin["chat.params"]({ sessionID: SESSION, agent })
  for (const name of loaded) {
    await plugin["tool.execute.after"]({ tool: "skill", sessionID: SESSION, args: { name } })
  }
}

const call = (tool, args) =>
  plugin["tool.execute.before"]({ tool, sessionID: SESSION, callID: "c1" }, { args })

const bash = command => call("bash", { command })

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "pc-guard-"))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe("git staging and history", () => {
  beforeEach(() => load())

  it.each([
    ["git add -A", "shared tree"],
    ["git add --all", "shared tree"],
    ["git add .", "shared tree"],
    ["git commit -am 'x'", "not yours"],
    ["git clean -f", "untracked files"],
    ["git reset --hard HEAD~1", "discards uncommitted work"],
    ["git stash drop", "set aside"],
    ["git stash clear", "set aside"],
    ["git checkout .", "every uncommitted change"],
    ["git restore .", "every uncommitted change"],
  ])("denies %s", async (command, fragment) => {
    await expect(bash(command)).rejects.toThrow(fragment)
  })

  it.each([
    "git add src/thing.ts src/other.ts",
    "git commit -m 'scoped'",
    "git clean -f -- src/generated",
    "git checkout -- src/thing.ts",
    "git stash list",
    "git status",
  ])("allows %s", async command => {
    await expect(bash(command)).resolves.toBeUndefined()
  })

  // One allowed read followed by a destructive segment is not a read.
  it("checks every segment of a compound command", async () => {
    await expect(bash("git status && git add -A")).rejects.toThrow("shared tree")
    await expect(bash("ls; git clean -f")).rejects.toThrow("untracked files")
  })
})

describe("pushing the default branch", () => {
  // The branch has to be configured, not assumed: detectDefaultBranch falls back to the machine's
  // global init.defaultBranch, which is "master" on some developer machines and "main" on others,
  // so a test that hardcodes either passes or fails depending on whose laptop it runs on.
  const withDefaultBranch = async branch => {
    const { execFileSync } = await import("node:child_process")
    execFileSync("git", ["init", "--quiet"], { cwd: root })
    execFileSync("git", ["config", "init.defaultBranch", branch], { cwd: root })
    await load()
  }

  it.each([
    "git push origin main",
    "git push origin HEAD:main",
    "git push --set-upstream origin main",
  ])("denies %s", async command => {
    await withDefaultBranch("main")
    await expect(bash(command)).rejects.toThrow("default branch")
  })

  // The name must be delimited by start, end, whitespace or a colon. These hold "main" as a
  // substring and are either somebody else's branch or a fully qualified ref.
  it.each([
    "git push origin mainline",
    "git push origin feature/main-thing",
    "git push origin refs/heads/main",
  ])("allows %s", async command => {
    await withDefaultBranch("main")
    await expect(bash(command)).resolves.toBeUndefined()
  })

  // The match used to interpolate the name into `new RegExp`, so a name carrying regex
  // metacharacters was read as a pattern: it failed to match itself, letting through the exact
  // push this guard exists to refuse, and matched unrelated branches instead.
  it("treats a branch name containing regex metacharacters literally", async () => {
    await withDefaultBranch("release/v1.0+x")
    await expect(bash("git push origin release/v1.0+x")).rejects.toThrow("default branch")
    await expect(bash("git push origin release/v1.00000x")).resolves.toBeUndefined()
  })
})

describe("force push", () => {
  beforeEach(() => load())

  it("denies --force without a lease", async () => {
    await expect(bash("git push --force origin feature/x")).rejects.toThrow("overwrite commits")
  })

  it("allows --force-with-lease", async () => {
    await expect(bash("git push --force-with-lease origin feature/x")).resolves.toBeUndefined()
  })
})

describe("scratch files", () => {
  beforeEach(() => load())

  it("denies a write to an OS temp directory", async () => {
    await expect(bash("echo hi > /tmp/notes.txt")).rejects.toThrow("inside the repository")
    await expect(bash("cp report.json $TMPDIR/report.json")).rejects.toThrow("inside the repository")
  })

  it("allows reading from one", async () => {
    await expect(bash("cat /tmp/existing.log")).resolves.toBeUndefined()
  })

  // `/tmp/gh-aw/` is the agent workflow runtime's own directory, not agent scratch. GitHub
  // Agentic Workflows stages the issue context, the diff and the review comments there before
  // the agent starts, and the worker prompts tell it to read them. This check tests the whole
  // command string, so it could not tell "write to /tmp" from "read from /tmp", and a command
  // that read one of those files and wrote the result anywhere at all was denied. Three refine
  // runs in a row spent their entire turn arguing with it and emitted nothing.
  it("allows the agent workflow runtime directory", async () => {
    await expect(bash("jq -r .body /tmp/gh-aw/agent/issue-context.json > .opencode/.tmp/body.md"))
      .resolves.toBeUndefined()
    await expect(bash("mkdir -p /tmp/gh-aw/agent")).resolves.toBeUndefined()
    await expect(bash("gh pr diff 12 > /tmp/gh-aw/agent/diff.patch")).resolves.toBeUndefined()
  })

  // A sibling that merely begins the same way is still scratch.
  it("denies a directory whose name only starts like the runtime one", async () => {
    await expect(bash("echo hi > /tmp/gh-awful/x")).rejects.toThrow("inside the repository")
    await expect(bash("echo hi > /tmp/gh-aw-notes")).rejects.toThrow("inside the repository")
  })

  it("denies reading the runtime directory and writing elsewhere", async () => {
    await expect(bash("jq . /tmp/gh-aw/agent/issue-context.json > /tmp/elsewhere.json"))
      .rejects.toThrow("inside the repository")
  })

  it("denies an absolute write outside the repo", async () => {
    const outside = path.join(os.tmpdir(), "elsewhere", "file.md")
    await expect(call("write", { filePath: outside, content: "x" })).rejects.toThrow("outside the repository")
  })

  it("allows a write inside the repo", async () => {
    await expect(call("write", { filePath: path.join(root, "src", "a.ts"), content: "x" })).resolves.toBeUndefined()
    await expect(call("edit", { filePath: "src/relative.ts" })).resolves.toBeUndefined()
  })
})

describe("platform data comes from the CLI", () => {
  beforeEach(() => load())

  it.each([
    "https://github.com/org/repo/pull/1",
    "https://api.github.com/repos/org/repo",
    "https://dev.azure.com/org/project/_workitems/edit/5",
    "https://acme.atlassian.net/browse/ABC-1",
    "https://gitlab.com/org/repo/-/merge_requests/2",
  ])("denies webfetch of %s", async url => {
    await expect(call("webfetch", { url })).rejects.toThrow("must come from its CLI")
  })

  it("allows webfetch of an unrelated host", async () => {
    await expect(call("webfetch", { url: "https://models.dev/api.json" })).resolves.toBeUndefined()
  })

  it("keeps browser tools on localhost when the backlog is not browser-based", async () => {
    await expect(call("agent-browser_navigate", { url: "http://localhost:3000/" })).resolves.toBeUndefined()
    await expect(call("agent-browser_navigate", { url: "https://example.com/" })).rejects.toThrow("localhost")
  })

  it("lets a browser backlog reach its own tracker", async () => {
    await load({ backlog: "browser" })
    await expect(call("agent-browser_navigate", { url: "https://linear.app/team/issue/X" })).resolves.toBeUndefined()
    // github still belongs to gh, whatever the backlog is.
    await expect(call("agent-browser_navigate", { url: "https://github.com/org/repo" })).rejects.toThrow("must come from its CLI")
  })
})

describe("the plan agent is read-only", () => {
  beforeEach(() => load({ agent: "plan" }))

  it.each([
    "git status",
    "git log --oneline -5",
    "git diff HEAD~1",
    "git rev-parse --show-toplevel",
    "git branch --show-current",
    "openspec list --json",
    "rg TODO src",
    "cat package.json",
  ])("allows the inspection command %s", async command => {
    await expect(bash(command)).resolves.toBeUndefined()
  })

  it.each([
    "npm install",
    "rm -rf dist",
    "sed -i 's/a/b/' file.ts",
    "echo x > file.ts",
    "git switch -c feature/x",
  ])("denies %s", async command => {
    await expect(bash(command)).rejects.toThrow("plan agent reads")
  })

  it("denies a redirect from an otherwise allowed command", async () => {
    await expect(bash("cat a.ts > b.ts")).rejects.toThrow("plan agent reads")
    await expect(bash("git log | tee log.txt")).rejects.toThrow("plan agent reads")
  })

  it("does not restrict the build agent the same way", async () => {
    await load({ agent: "build" })
    await expect(bash("npm install")).resolves.toBeUndefined()
  })

  // `backend-engineer.plan` is the cheap-model tier of an engineer, not the
  // read-only plan primary. Only an exact `plan` base is read-only.
  it("does not restrict an engineer's plan tier", async () => {
    await load({ agent: "backend-engineer.plan" })
    await expect(bash("npm install")).resolves.toBeUndefined()
  })
})

describe("required skills gate", () => {
  it("blocks work while an installed skill is unloaded", async () => {
    await load({ loaded: [] })

    await expect(bash("npm test")).rejects.toThrow("Required skills are not loaded")
    await expect(call("edit", { filePath: "src/a.ts" })).rejects.toThrow("Required skills are not loaded")
    await expect(call("task", { subagent_type: "backend-engineer" })).rejects.toThrow("Required skills are not loaded")
  })

  it("never gates the tools needed to satisfy it", async () => {
    await load({ loaded: [] })

    for (const tool of ["skill", "read", "grep", "glob"]) {
      await expect(call(tool, { name: "pc-guardrails-generic" })).resolves.toBeUndefined()
    }
  })

  it("opens once the skill is loaded", async () => {
    await load({ loaded: ["pc-guardrails-generic"] })
    await expect(bash("npm test")).resolves.toBeUndefined()
  })

  // A dangling @skill reference would otherwise be unloadable, and the worker
  // would be stuck forever on a rule it cannot satisfy.
  it("ignores a required skill that is not installed", async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "pc-guard-"))
    fs.mkdirSync(path.join(root, ".opencode", "agents"), { recursive: true })
    fs.writeFileSync(
      path.join(root, ".opencode", "agents", "build.md"),
      "---\nmode: primary\n---\n\nBody.\n\n## Abilities\n- Guardrails: @pc-does-not-exist\n",
    )
    plugin = await PcSystemReminders({ directory: root })
    await plugin["chat.params"]({ sessionID: SESSION, agent: "build" })

    await expect(bash("npm test")).resolves.toBeUndefined()
  })

  it("re-arms after compaction", async () => {
    await load({ loaded: ["pc-guardrails-generic"] })
    await expect(bash("npm test")).resolves.toBeUndefined()

    await plugin.event({ event: { type: "session.compacted", properties: { sessionID: SESSION } } })

    await expect(bash("npm test")).rejects.toThrow("Required skills are not loaded")
  })
})

describe("fails open", () => {
  it("allows everything for an unknown session", async () => {
    await load({ loaded: [] })
    const other = (tool, args) =>
      plugin["tool.execute.before"]({ tool, sessionID: "ses_unseen", callID: "c" }, { args })

    // No state for this session, so the skill gate cannot apply. A deny here
    // would break every subagent that has not reached chat.params yet.
    await expect(other("bash", { command: "npm test" })).resolves.toBeUndefined()
    await expect(other("edit", { filePath: "src/a.ts" })).resolves.toBeUndefined()
  })

  it("allows the call when its own check throws", async () => {
    await load()

    // The guard's own exception is not a rule violation, so the call proceeds.
    const exploding = {
      get args() {
        throw new Error("guard bug")
      },
    }
    await expect(
      plugin["tool.execute.before"]({ tool: "bash", sessionID: SESSION, callID: "c" }, exploding),
    ).resolves.toBeUndefined()

    // Nor is a malformed payload.
    await expect(plugin["tool.execute.before"]({ tool: "bash", sessionID: SESSION }, null)).resolves.toBeUndefined()
    await expect(call("bash", { command: 42 })).resolves.toBeUndefined()
    await expect(call("webfetch", { url: "not a url" })).resolves.toBeUndefined()
  })

  it("ignores tools it does not guard", async () => {
    await load()
    await expect(call("todowrite", { todos: [] })).resolves.toBeUndefined()
    await expect(call("question", {})).resolves.toBeUndefined()
  })
})
