import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"

vi.mock("@opencode/plugin", () => ({ Plugin: { define: definition => definition } }))

import PcCommitCoauthor, { TRAILER, withTrailer } from "./pc-commit-coauthor.js"

const FLAG = `--trailer "${TRAILER}"`

async function loadHook() {
  let hook
  await PcCommitCoauthor.setup({
    tool: { hook: (name, cb) => { if (name === "execute.before") hook = cb; return Promise.resolve({ dispose() {} }) } },
  })
  return hook
}

describe("withTrailer", () => {
  it.each([
    ['git commit -m "feat: x"', `git commit ${FLAG} -m "feat: x"`],
    ["git commit", `git commit ${FLAG}`],
    ["git add a.js && git commit -m x", `git add a.js && git commit ${FLAG} -m x`],
    ["git add a.js; git commit -F msg.txt", `git add a.js; git commit ${FLAG} -F msg.txt`],
    ["git -C ../repo commit -m x", `git -C ../repo commit ${FLAG} -m x`],
    ['git -c user.name="A B" commit -m x', `git -c user.name="A B" commit ${FLAG} -m x`],
    ["git commit --amend --no-edit", `git commit ${FLAG} --amend --no-edit`],
    ["(cd sub && git commit -m x)", `(cd sub && git commit ${FLAG} -m x)`],
  ])("adds the trailer to %s", (command, expected) => {
    expect(withTrailer(command)).toBe(expected)
  })

  it.each([
    "git status",
    "git commit-tree HEAD^{tree} -m x",
    "git log --grep commit",
    'echo "git commit"',
    `git commit ${FLAG} -m x`,
    'git commit -m "x\n\nCo-Authored-By: opencode <noreply@opencode.ai>"',
  ])("leaves %s alone", command => {
    expect(withTrailer(command)).toBe(command)
  })

  it("adds it to every commit in a compound command", () => {
    expect(withTrailer("git commit -m a && git commit -m b")).toBe(`git commit ${FLAG} -m a && git commit ${FLAG} -m b`)
  })

  it("produces a commit git actually signs with the trailer", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "pc-coauthor-"))
    try {
      const git = args => execFileSync("git", args, { cwd: repo, encoding: "utf-8" })
      git(["init", "-q"])
      git(["config", "user.email", "test@example.com"])
      git(["config", "user.name", "Test"])
      fs.writeFileSync(path.join(repo, "a.txt"), "a\n")
      git(["add", "a.txt"])
      execFileSync(withTrailer('git commit -q -m "feat: a"'), { cwd: repo, shell: true })

      expect(git(["log", "-1", "--format=%B"]).trim()).toBe(`feat: a\n\n${TRAILER}`)
    } finally {
      fs.rmSync(repo, { recursive: true, force: true })
    }
  })
})

describe("execute.before hook", () => {
  it("rewrites the shell tool's command", async () => {
    const hook = await loadHook()
    const event = { tool: "shell", input: { command: "git commit -m x", workdir: "." } }

    await hook(event)

    expect(event.input).toEqual({ command: `git commit ${FLAG} -m x`, workdir: "." })
  })

  it("ignores other tools and malformed input", async () => {
    const hook = await loadHook()
    const edit = { tool: "edit", input: { command: "git commit -m x" } }
    const empty = { tool: "shell", input: undefined }

    await hook(edit)
    await hook(empty)

    expect(edit.input.command).toBe("git commit -m x")
    expect(empty.input).toBeUndefined()
  })
})
