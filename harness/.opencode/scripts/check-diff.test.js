import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { addedLines, collect, evaluate, scope } from "./check-diff.mjs"
import { slopFindings } from "./code-rules.mjs"

const all = text => new Set(text.split("\n").map((_, k) => k + 1))
const rules = result => result.violations.map(v => v.rule)

describe("check-diff", () => {
  it("holds added comments to a tenth of the added code", () => {
    const code = Array.from({ length: 30 }, (_, k) => `const v${k} = ${k}`)
    const within = [...code, "// the vendor API rejects batches over 30", "// see their changelog"].join("\n")
    const over = [...code, ...Array.from({ length: 4 }, (_, k) => `// note ${k}`)].join("\n")

    expect(rules(evaluate([{ path: "src/a.ts", before: null, after: within, added: all(within) }]))).toEqual([])
    expect(rules(evaluate([{ path: "src/a.ts", before: null, after: over, added: all(over) }]))).toEqual(["comment-budget"])
  })

  it("makes a touched file leave its old slop behind, and leaves untouched files alone", () => {
    const before = "// ======\nconst a = 1\n"
    const after = "// ======\nconst a = 2\n"

    const result = evaluate([{ path: "src/a.ts", before, after, added: new Set([2]) }])

    expect(result.violations).toMatchObject([{ rule: "touched-file-slop", file: "src/a.ts", line: 1, detail: "banner" }])
  })

  it("holds tests to the size of the change and refuses suspicious ones", () => {
    const test = Array.from({ length: 5 }, (_, k) => `it('case ${k}', () => { run() })`).join("\n")

    const result = evaluate([
      { path: "src/a.ts", before: null, after: "export const a = 1", added: new Set([1]) },
      { path: "src/a.test.ts", before: null, after: test, added: all(test) },
    ])

    expect(rules(result)).toEqual(["test-no-assertion", "case-budget"])
  })

  it("does not count a tool directive as a comment", () => {
    const code = Array.from({ length: 10 }, (_, k) => `const v${k} = ${k}`)
    const pragmas = ["// nosemgrep: pliny-hygiene-ts-empty-catch - storage may be blocked", "// biome-ignore lint/suspicious/noExplicitAny: vendor type", "// eslint-disable-next-line no-console"]
    const after = [...code, ...pragmas].join("\n")

    const result = evaluate([{ path: "src/a.ts", before: null, after, added: all(after) }])

    expect(result.totals.comments).toBe(0)
    expect(rules(result)).toEqual([])
  })

  it("gives new lines in a file the complexity gate tracks twice the test budget", () => {
    const code = Array.from({ length: 30 }, (_, k) => `const v${k} = ${k}`).join("\n")
    const test = Array.from({ length: 50 }, (_, k) => `expect(v${k}).toBe(${k})`).join("\n")
    const files = [
      { path: "src/a.ts", before: null, after: code, added: all(code) },
      { path: "src/a.test.ts", before: null, after: test, added: all(test) },
    ]

    expect(rules(evaluate(files))).toEqual(["test-budget"])
    expect(rules(evaluate(files, undefined, new Set(["src/a.ts"])))).toEqual([])
  })

  it("reads TODO only in comments, not in strings", () => {
    expect(slopFindings("const s = '// TODO later'")).toEqual([])
    expect(slopFindings("run() // TODO later")).toEqual([{ rule: "untracked-todo", line: 1 }])
  })

  it("reads added lines from zero-context hunks", () => {
    expect([...addedLines("@@ -1,0 +2,2 @@\n+a\n+b\n@@ -9 +11 @@\n-c\n+d\n@@ -20,3 +23,0 @@")]).toEqual([2, 3, 11])
  })

  it("collects committed, uncommitted and untracked changes against the base", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-diff-"))
    const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
    git("init", "-q")
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "base")
    const base = git("rev-parse", "HEAD")
    fs.mkdirSync(path.join(root, "src"))
    fs.writeFileSync(path.join(root, "src", "a.ts"), "const a = 1\n")
    git("add", "src/a.ts")
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "a")
    fs.writeFileSync(path.join(root, "src", "a.ts"), "const a = 1\nconst b = 2\n")
    fs.writeFileSync(path.join(root, "src", "c.ts"), "const c = 3\n")

    const files = collect(root, base)

    expect(files.map(f => [f.path, f.before, [...f.added]])).toEqual([
      ["src/a.ts", null, [1, 2]],
      ["src/c.ts", null, [1]],
    ])
  })

  it("scopes the check to the files and folders a worker owns", () => {
    const files = ["src/api/a.ts", "src/api-old/b.ts", "web/c.tsx", "tests/d.test.ts"].map(p => ({ path: p }))

    expect(scope(files, ["src/api", "./tests/d.test.ts"]).map(f => f.path)).toEqual(["src/api/a.ts", "tests/d.test.ts"])
    expect(scope(files, undefined)).toBe(files)
  })
})

describe("check-diff on platform files", { timeout: 30000 }, () => {
  const script = path.join(import.meta.dirname, "check-diff.mjs")

  function fixture({ answers = "_commit: v1.0.0\n", manifest = "apps/api/src/Platform/**\n" } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-diff-platform-"))
    const git = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: root, encoding: "utf8" }).trim()
    const write = (file, text) => {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      fs.writeFileSync(path.join(root, file), text)
    }
    git("init", "-q")
    write("apps/api/src/Platform/session.ts", "export const ttl = 1\n")
    write("apps/api/src/orders.ts", "export const orders = []\n")
    if (answers) write(".copier-answers.yml", answers)
    if (manifest) write(".platform/manifest", manifest)
    git("add", "-A")
    git("commit", "-q", "-m", "base")
    const base = git("rev-parse", "HEAD")
    const run = () => {
      const result = spawnSync(process.execPath, [script, "--base", base], { cwd: root, encoding: "utf8" })
      return { status: result.status, output: result.stdout.replaceAll(base, "<base>").replace(base.slice(0, 7), "<base>") }
    }
    return { write, run }
  }

  it("fails on a changed platform file and passes on app files", () => {
    const repo = fixture()
    repo.write("apps/api/src/orders.ts", "export const orders = [1]\n")
    expect(repo.run().status).toBe(0)

    repo.write("apps/api/src/Platform/session.ts", "export const ttl = 2\n")
    const { status, output } = repo.run()
    expect(status).toBe(1)
    expect(output).toContain("platform-file")
    expect(output).toContain("apps/api/src/Platform/session.ts")
  })

  it("passes a change an unexpired exception covers, but not an expired one", () => {
    const repo = fixture()
    repo.write("apps/api/src/Platform/session.ts", "export const ttl = 2\n")
    const exception = expires => `exceptions:\n  - path: apps/api/src/Platform/session.ts\n    reason: longer sessions\n    issue: https://example.test/2\n    expires: "${expires}"\n`

    repo.write(".platform/exceptions.yml", exception("2999-12-31"))
    expect(repo.run().status).toBe(0)
    repo.write(".platform/exceptions.yml", exception("2000-01-01"))
    expect(repo.run().status).toBe(1)
  })

  it("passes a template sync, which moves _commit in the same diff", () => {
    const repo = fixture()
    repo.write("apps/api/src/Platform/session.ts", "export const ttl = 2\n")
    repo.write(".copier-answers.yml", "_commit: v1.1.0\n")

    expect(repo.run().status).toBe(0)
  })

  it("prints exactly what it printed before in a repository that has not opted in", () => {
    const optedOut = fixture({ answers: null })
    const bare = fixture({ answers: null, manifest: null })
    for (const repo of [optedOut, bare]) repo.write("apps/api/src/Platform/session.ts", "export const ttl = 2\n")

    expect(optedOut.run()).toEqual(bare.run())
    expect(bare.run().status).toBe(0)
  })
})
