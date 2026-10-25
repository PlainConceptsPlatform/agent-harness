import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@opencode/plugin", () => ({ Plugin: { define: definition => definition } }))

import PcSystemReminders from "./index.js"

// The guard turns the harness "never" rules into denied permission decisions.
// In OpenCode 2 a denial sets the event effect to "deny" and carries a message;
// the fail-open cases assert the effect is left alone, which matters more than
// any single rule: a guard that breaks a session over its own bug is worse than
// the rule it enforces.

let root
let hooks
const SESSION = "ses_test"

async function install({ agent = "build", loaded = ["pc-guardrails-generic"], backlog = "github" } = {}) {
  fs.mkdirSync(path.join(root, ".opencode", "agents"), { recursive: true })
  fs.mkdirSync(path.join(root, ".agents", "skills", "pc-guardrails-generic"), { recursive: true })
  fs.writeFileSync(path.join(root, ".agents", "skills", "pc-guardrails-generic", "SKILL.md"), "# Guardrails\n")
  const base = agent.replace(/\.(?:build|fast|plan)$/, "")
  fs.writeFileSync(
    path.join(root, ".opencode", "agents", `${base}.md`),
    `---\nmode: primary\n---\n\nBody.\n\n## Abilities\n- Guardrails: @pc-guardrails-generic\n`,
  )
  fs.writeFileSync(path.join(root, ".opencode", "harness.json"), JSON.stringify({ platform: { backlog } }))

  hooks = {}
  await PcSystemReminders.setup({
    location: { directory: root },
    session: { hook: (name, cb) => { hooks[name] = cb; return Promise.resolve({ dispose() {} }) } },
    permission: { hook: (name, cb) => { hooks[name] = cb; return Promise.resolve({ dispose() {} }) } },
  })
  for (const name of loaded) {
    await hooks.evaluate({ sessionID: SESSION, agent, action: "skill", resources: [name], effect: "allow" })
  }
}

async function evaluate(overrides = {}) {
  const event = { sessionID: SESSION, agent: "build", action: "shell", resources: [], effect: "allow", ...overrides }
  await hooks.evaluate(event)
  return event
}

const bash = (command, agent = "build") => evaluate({ action: "shell", resources: [command], agent })

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "pc-guard-"))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe("git staging and history", () => {
  beforeEach(() => install())

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
    const event = await bash(command)
    expect(event.effect).toBe("deny")
    expect(event.message).toContain(fragment)
  })

  it.each([
    "git add src/thing.ts src/other.ts",
    "git commit -m 'scoped'",
    "git clean -f -- src/generated",
    "git checkout -- src/thing.ts",
    "git stash list",
    "git status",
  ])("allows %s", async command => {
    expect((await bash(command)).effect).toBe("allow")
  })

  it("checks every segment of a compound command", async () => {
    expect((await bash("git status && git add -A")).effect).toBe("deny")
    expect((await bash("ls; git clean -f")).effect).toBe("deny")
  })
})

describe("pushing the default branch", () => {
  const withDefaultBranch = async branch => {
    const { execFileSync } = await import("node:child_process")
    execFileSync("git", ["init", "--quiet"], { cwd: root })
    execFileSync("git", ["config", "init.defaultBranch", branch], { cwd: root })
    await install()
  }

  it.each([
    "git push origin main",
    "git push origin HEAD:main",
    "git push --set-upstream origin main",
  ])("denies %s", async command => {
    await withDefaultBranch("main")
    const event = await bash(command)
    expect(event.effect).toBe("deny")
    expect(event.message).toContain("default branch")
  })

  it.each([
    "git push origin mainline",
    "git push origin feature/main-thing",
    "git push origin refs/heads/main",
  ])("allows %s", async command => {
    await withDefaultBranch("main")
    expect((await bash(command)).effect).toBe("allow")
  })

  it("treats a branch name containing regex metacharacters literally", async () => {
    await withDefaultBranch("release/v1.0+x")
    expect((await bash("git push origin release/v1.0+x")).effect).toBe("deny")
    expect((await bash("git push origin release/v1.00000x")).effect).toBe("allow")
  })
})

describe("force push", () => {
  beforeEach(() => install())

  it("denies --force without a lease", async () => {
    expect((await bash("git push --force origin feature/x")).effect).toBe("deny")
  })

  it("allows --force-with-lease", async () => {
    expect((await bash("git push --force-with-lease origin feature/x")).effect).toBe("allow")
  })
})

describe("scratch files", () => {
  beforeEach(() => install())

  it("denies a write to an OS temp directory", async () => {
    expect((await bash("echo hi > /tmp/notes.txt")).effect).toBe("deny")
    expect((await bash("cp report.json $TMPDIR/report.json")).effect).toBe("deny")
  })

  it("allows reading from one", async () => {
    expect((await bash("cat /tmp/existing.log")).effect).toBe("allow")
  })

  it("allows the agent workflow runtime directory", async () => {
    expect((await bash("jq -r .body /tmp/gh-aw/agent/issue-context.json > .opencode/.tmp/body.md")).effect).toBe("allow")
    expect((await bash("mkdir -p /tmp/gh-aw/agent")).effect).toBe("allow")
  })

  it("denies a directory whose name only starts like the runtime one", async () => {
    expect((await bash("echo hi > /tmp/gh-awful/x")).effect).toBe("deny")
    expect((await bash("echo hi > /tmp/gh-aw-notes")).effect).toBe("deny")
  })

  it("denies an absolute write outside the repo", async () => {
    const outside = path.join(os.tmpdir(), "elsewhere", "file.md")
    const event = await evaluate({ action: "edit", resources: [outside] })
    expect(event.effect).toBe("deny")
    expect(event.message).toContain("outside the repository")
  })

  it("allows a write inside the repo", async () => {
    expect((await evaluate({ action: "edit", resources: [path.join(root, "src", "a.ts")] })).effect).toBe("allow")
    expect((await evaluate({ action: "edit", resources: ["src/relative.ts"] })).effect).toBe("allow")
  })
})

describe("platform data comes from the CLI", () => {
  beforeEach(() => install())

  it.each([
    "https://github.com/org/repo/pull/1",
    "https://api.github.com/repos/org/repo",
    "https://dev.azure.com/org/project/_workitems/edit/5",
    "https://acme.atlassian.net/browse/ABC-1",
    "https://gitlab.com/org/repo/-/merge_requests/2",
  ])("denies webfetch of %s", async url => {
    const event = await evaluate({ action: "webfetch", resources: [url] })
    expect(event.effect).toBe("deny")
    expect(event.message).toContain("must come from its CLI")
  })

  it("allows webfetch of an unrelated host", async () => {
    expect((await evaluate({ action: "webfetch", resources: ["https://models.dev/api.json"] })).effect).toBe("allow")
  })
})

describe("the plan agent is read-only", () => {
  beforeEach(() => install({ agent: "plan" }))

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
    expect((await bash(command, "plan")).effect).toBe("allow")
  })

  it.each([
    "npm install",
    "rm -rf dist",
    "sed -i 's/a/b/' file.ts",
    "echo x > file.ts",
    "git switch -c feature/x",
  ])("denies %s", async command => {
    const event = await bash(command, "plan")
    expect(event.effect).toBe("deny")
    expect(event.message).toContain("plan agent reads")
  })

  it("denies a redirect from an otherwise allowed command", async () => {
    expect((await bash("cat a.ts > b.ts", "plan")).effect).toBe("deny")
    expect((await bash("git log | tee log.txt", "plan")).effect).toBe("deny")
  })

  it("does not restrict the build agent the same way", async () => {
    expect((await bash("npm install", "build")).effect).toBe("allow")
  })

  it("does not restrict an engineer's plan tier", async () => {
    expect((await bash("npm install", "backend-engineer.plan")).effect).toBe("allow")
  })
})

describe("required skills gate", () => {
  it("blocks work while an installed skill is unloaded", async () => {
    await install({ loaded: [] })

    expect((await bash("npm test")).effect).toBe("deny")
    expect((await evaluate({ action: "edit", resources: ["src/a.ts"] })).effect).toBe("deny")
    expect((await evaluate({ action: "subagent", resources: ["backend-engineer"] })).effect).toBe("deny")
  })

  it("never gates the actions needed to satisfy it", async () => {
    await install({ loaded: [] })

    for (const action of ["read", "grep", "glob"]) {
      expect((await evaluate({ action, resources: ["x"] })).effect).toBe("allow")
    }
    // Loading the skill is not itself blocked.
    expect((await evaluate({ action: "skill", resources: ["pc-guardrails-generic"] })).effect).toBe("allow")
  })

  it("opens once the skill is loaded", async () => {
    await install({ loaded: ["pc-guardrails-generic"] })
    expect((await bash("npm test")).effect).toBe("allow")
  })

  it("ignores a required skill that is not installed", async () => {
    fs.mkdirSync(path.join(root, ".opencode", "agents"), { recursive: true })
    fs.writeFileSync(
      path.join(root, ".opencode", "agents", "build.md"),
      "---\nmode: primary\n---\n\nBody.\n\n## Abilities\n- Guardrails: @pc-does-not-exist\n",
    )
    hooks = {}
    await PcSystemReminders.setup({
      location: { directory: root },
      session: { hook: (name, cb) => { hooks[name] = cb; return Promise.resolve({ dispose() {} }) } },
      permission: { hook: (name, cb) => { hooks[name] = cb; return Promise.resolve({ dispose() {} }) } },
    })

    expect((await bash("npm test")).effect).toBe("allow")
  })
})

describe("fails open", () => {
  beforeEach(() => install({ loaded: [] }))

  it("leaves the effect alone when its own check throws", async () => {
    await install({ loaded: ["pc-guardrails-generic"] })
    expect((await evaluate({ action: "shell", resources: 42 })).effect).toBe("allow")
  })

  it("leaves the effect alone for a malformed event", async () => {
    const event = { effect: "allow" }
    await hooks.evaluate(event)
    expect(event.effect).toBe("allow")
  })

  it("ignores actions it does not guard", async () => {
    expect((await evaluate({ action: "todowrite", resources: ["x"] })).effect).toBe("allow")
    expect((await evaluate({ action: "question", resources: ["*"] })).effect).toBe("allow")
  })
})
