import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { isOwned, isTemplateSource, loadContract, matchGlob, normalizeRepoUrl } from "./platform-contract.mjs"

// The 3.8.0 matcher, kept as the oracle the hand-written one must agree with.
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
function legacyGlob(glob) {
  const directory = glob.endsWith("/")
  const body = glob.replace(/\/$/, "")
  const pattern = body.replace(/^\//, "")
  let source = ""
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === "*" && pattern[i + 1] === "*" && (i === 0 || pattern[i - 1] === "/")) {
      if (i + 2 === pattern.length) {
        source += ".*"
        i += 1
        continue
      }
      if (pattern[i + 2] === "/") {
        source += "(?:.*/)?"
        i += 2
        continue
      }
    }
    if (c === "*") {
      source += "[^/]*"
      while (pattern[i + 1] === "*") i++
    } else if (c === "?") source += "[^/]"
    else if (c === "[" && pattern.indexOf("]", i + 2) !== -1) {
      const end = pattern.indexOf("]", i + 2)
      source += `[${pattern.slice(i + 1, end).replace(/^!/, "^")}]`
      i = end
    } else if (c === "\\" && i + 1 < pattern.length) source += escapeRegExp(pattern[++i])
    else source += escapeRegExp(c)
  }
  return new RegExp(`^${body.includes("/") ? "" : "(?:.*/)?"}${source}${directory ? "/.*" : "(?:/.*)?"}$`)
}

const GLOBS = [
  "apps/api/src/Platform/**", "/Directory.Build.props", "Directory.Build.props", "**/*.csproj", "*.md", "docs/", "/docs/",
  "apps/**/Platform/*.cs", "a/**/b/**/c", "**", "**/", "a/**/", "a/**", "**/b", "a/**b", "**.js", "a/***/b", "a/*/b", "a?c",
  "file[0-9].ts", "file[!0-9].ts", "[abc]*", "[a-]x", "\\*.md", "a\\ b", "x[", "a/b/", "a//b", "a.b", "a+b(1)", "$x^",
]
const PATHS = [
  "", "a", "a/", "a/b", "a/b/c", "a/x/b/y/c", "a/b/c/d", "a//b", "x/a/b", "ab", "abc", "a/bb", "a/xb", "a.js", "x/y.js",
  "Directory.Build.props", "src/Directory.Build.props", "apps/api/src/Platform/session.ts", "apps/api/src/Platform",
  "apps/api/src/PlatformX/a.ts", "apps/web/Platform/x.cs", "apps/web/deep/Platform/x.cs", "apps/web/Platform/sub/x.cs",
  "README.md", "docs/README.md", "docs", "docs/a/b", "x/docs/a", "x/docs", "web/app.csproj", "app.csproj", "file1.ts",
  "fileA.ts", "src/file9.ts", "b", "bxy", "-x", "ax", "*.md", "x.md", "a b", "x[", "a.b", "axb", "a+b(1)", "$x^",
]

describe("platform-contract globs", () => {
  it("agrees with the 3.8.0 RegExp matcher on every glob and path", () => {
    for (const glob of GLOBS) {
      const legacy = legacyGlob(glob)
      for (const file of PATHS) expect([glob, file, matchGlob(glob, file)]).toEqual([glob, file, legacy.test(file)])
    }
  })

  it("matches the tricky gitwildmatch shapes", () => {
    const cases = [
      ["/docs/", "docs/a.md", true], ["/docs/", "x/docs/a.md", false], ["docs/", "x/docs/a.md", true], ["docs/", "docs", false],
      ["a/**/b", "a/b", true], ["a/**/b", "a/x/y/b/z", true], ["a/**", "a", false], ["a/**", "a/x/y", true],
      ["**/*.cs", "Platform.cs", true], ["*.cs", "src/x/Platform.cs", true], ["src/*.cs", "src/x/Platform.cs", false],
      ["a?c", "a/c", false], ["file[!0-9].ts", "file/.ts", false], ["\\*.md", "x.md", false], ["\\*.md", "*.md", true],
    ]
    for (const [glob, file, expected] of cases) expect([glob, file, matchGlob(glob, file)]).toEqual([glob, file, expected])
  })

  it("lets a later `!` glob carve a path out and a later glob take it back", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "contract-"))
    fs.mkdirSync(path.join(root, ".platform"))
    fs.writeFileSync(path.join(root, ".platform/contract.yml"), "version: 1\nsource:\n  name: Acme\n  url: https://example.test/t\nowned: [apps/**, \"!apps/web/**\", apps/web/Platform/]\n")
    const contract = loadContract(root)

    const owned = ["apps/api/a.cs", "apps/web/a.ts", "apps/web/Platform/a.ts", ".\\apps\\web\\Platform\\b.ts", "web/a.ts"].map(f => isOwned(contract, f))
    expect(owned).toEqual([true, false, true, true, false])
  })
})

describe("the template's own repository", () => {
  it("normalises the ways git spells one GitHub repository", () => {
    const spellings = [
      "https://github.com/PlainConceptsPlatform/Kitchen-Sink", "https://github.com/plainconceptsplatform/kitchen-sink.git",
      "git@github.com:PlainConceptsPlatform/Kitchen-Sink.git", "ssh://git@github.com/PlainConceptsPlatform/Kitchen-Sink.git",
      "https://token@github.com/PlainConceptsPlatform/Kitchen-Sink/", "git+https://github.com/PlainConceptsPlatform/Kitchen-Sink.git",
      "gh:PlainConceptsPlatform/Kitchen-Sink", " http://github.com/PlainConceptsPlatform/Kitchen-Sink.git\n",
    ]
    expect(new Set(spellings.map(normalizeRepoUrl))).toEqual(new Set(["https://github.com/plainconceptsplatform/kitchen-sink"]))
    expect(normalizeRepoUrl("https://github.com/PlainConceptsPlatform/Kitchen-Sink-App")).not.toBe(normalizeRepoUrl(spellings[0]))
  })

  it("is recognised by its origin remote, and never without one", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "contract-origin-"))
    const contract = { source: { url: "https://github.com/acme/app-template" } }
    expect(isTemplateSource(root, contract)).toBe(false)
    execFileSync("git", ["init", "-q"], { cwd: root })
    expect(isTemplateSource(root, contract)).toBe(false)
    execFileSync("git", ["remote", "add", "origin", "git@github.com:acme/app-template.git"], { cwd: root })
    expect(isTemplateSource(root, contract)).toBe(true)
    execFileSync("git", ["remote", "set-url", "origin", "https://github.com/acme/app"], { cwd: root })
    expect(isTemplateSource(root, contract)).toBe(false)
  })
})
