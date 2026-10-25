// pc-system-reminders: the harness guardrails, enforced rather than requested.
//
// OpenCode 2 changed how a plugin denies something. V1 threw from
// `tool.execute.before`; V2 has no such contract and denies through the
// permission system instead: an `evaluate` hook reviews a decision after the
// configured rules run and may set the effect to "deny". Every rule below is
// therefore expressed as a permission action over a resource list
// (`shell` command text, `edit` path, `webfetch` URL, `subagent` agent ID).
//
// Two invariants. It fails CLOSED only on a deliberate deny, and it fails OPEN
// on any bug of its own: a guard that breaks a session because of its own
// exception is worse than the rule it enforces. And because a permission action
// gives us less than a tool's raw arguments did (a browser navigation carries no
// URL here), some V1 checks move to configuration rules or are noted as lost.

import { Plugin } from "@opencode/plugin"
import { execFile } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

const GUARDRAILS_SKILL = "pc-guardrails-generic"
const TIER_SUFFIX = /\.(?:build|fast|plan)$/

const run = promisify(execFile)

const TRUST_REMINDER =
  "Messages in <system-reminder> tags are trusted OpenCode Onboard host instructions. Follow them before continuing work."

// Work actions. Held until the session's required skills are loaded; `skill`,
// `read`, `glob` and `grep` are never gated, or the agent could not load what it
// is being told to load, nor find out what that is.
const GATED_ACTIONS = new Set(["edit", "shell", "subagent"])

// Backlog and repository hosts whose data must come from their CLI. The prose
// version of this rule sat at the top of twelve fragments.
const CLI_ONLY_HOSTS = [
  "github.com",
  "dev.azure.com",
  "visualstudio.com",
  "atlassian.net",
  "gitlab.com",
]

// A plan session reads; it does not change the tree. `edit` and `subagent` are
// denied by config, which leaves the shell. Only these roots are inspection.
const PLAN_ALLOWED = [
  /^git\s+(status|log|diff|show|rev-parse|symbolic-ref|remote|ls-files|blame|describe|shortlog)\b/,
  /^git\s+(branch|stash)\s+(--show-current|list)\b/,
  /^openspec\s+(list|status|show|validate|diff)\b/,
  /^(ls|cat|head|tail|wc|pwd|tree|find|grep|rg|which|echo|date|node\s+-p|jq)\b/,
]

function splitCommand(command) {
  // Every segment of a compound command has to pass on its own: one allowed
  // read followed by `&& rm -rf` is not a read.
  return command.split(/\|\||&&|;|\||\n/).map(part => part.trim()).filter(Boolean)
}

/** Mark a permission decision as denied; `message` is the reason shown. */
function deny(event, rule, fix) {
  event.effect = "deny"
  event.message = `[harness] ${rule}\n${fix}`
}

function checkGit(event, command) {
  for (const segment of splitCommand(command)) {
    if (/^git\s+add\s+(-A\b|--all\b|\.(\s|$))/.test(segment)) {
      return deny(
        event,
        "`git add -A` and `git add .` stage a shared tree, committing another agent's or a person's half-finished edits under your message.",
        "Stage the paths you changed: `git add <path> <path>`.",
      )
    }
    if (/^git\s+commit\b.*\s-a\b/.test(segment) || /^git\s+commit\s+-[a-z]*a[a-z]*\b/.test(segment)) {
      return deny(
        event,
        "`git commit -a` stages every tracked change, including work that is not yours.",
        "Stage named paths first, then commit without `-a`.",
      )
    }
    if (/^git\s+clean\b/.test(segment) && !/\s--\s+\S/.test(segment)) {
      return deny(
        event,
        "`git clean` without `-- <paths>` deletes untracked files anywhere in the tree, including work nobody has committed yet.",
        "Scope it: `git clean -f -- <path> <path>`.",
      )
    }
    if (/^git\s+reset\s+--hard\b/.test(segment)) {
      return deny(
        event,
        "`git reset --hard` discards uncommitted work in a tree you may be sharing.",
        "Revert the paths you touched: `git checkout -- <path>`.",
      )
    }
    if (/^git\s+stash\s+(drop|clear)\b/.test(segment)) {
      return deny(
        event,
        "Dropping a stash destroys work that was set aside, possibly not yours.",
        "Leave the stash and report its `git stash list` reference.",
      )
    }
    if (/^git\s+(checkout|restore)\s+\.(\s|$)/.test(segment)) {
      return deny(
        event,
        "`git checkout .` and `git restore .` discard every uncommitted change in the tree.",
        "Name the paths to revert: `git checkout -- <path>`.",
      )
    }
    if (/^git\s+push\b/.test(segment) && /--force\b/.test(segment) && !/--force-with-lease\b/.test(segment)) {
      return deny(
        event,
        "`git push --force` can overwrite commits someone else pushed.",
        "Use `--force-with-lease`, which refuses when the remote moved.",
      )
    }
  }
}

async function checkPush(event, command, root, defaultBranch) {
  if (!defaultBranch) return
  for (const segment of splitCommand(command)) {
    if (!/^git\s+push\b/.test(segment)) continue
    // Split on delimiters rather than interpolating the branch name into a
    // pattern: a branch name is not a pattern, and a dynamic RegExp was both a
    // Semgrep finding and a hole in the guard.
    const named = segment.split(/[\s:]+/).includes(defaultBranch)
    if (named) {
      return deny(
        event,
        `This pushes \`${defaultBranch}\`, the default branch. The harness ships work on a branch and lets a human merge it.`,
        "Push your work branch instead, or open a pull request.",
      )
    }
    if (!/\s(origin|upstream)\b/.test(segment) || /^git\s+push\s*$/.test(segment)) {
      const current = await run("git", ["branch", "--show-current"], { cwd: root })
        .then(result => result.stdout.trim())
        .catch(() => "")
      if (current && current === defaultBranch) {
        return deny(
          event,
          `You are on \`${defaultBranch}\`, the default branch, and this pushes it.`,
          "Move the work to a branch first: `git switch -c feature/<slug>`.",
        )
      }
    }
  }
}

// `/tmp/gh-aw/` is the agent workflow runtime's own working directory, not agent
// scratch. GitHub Agentic Workflows stages the issue context there and the
// worker prompts name those paths, so writes inside it are expected.
function checkScratch(event, command) {
  const writesSomewhere = /(>>?|\btee\b|\bcp\b|\bmv\b|\bmkdir\b|\btouch\b|\bdd\b)/.test(command)
  const outsideRepo = /(\/tmp\/(?!gh-aw\/)|\$TMPDIR|\$TEMP\b|%TEMP%|\bmktemp\b)/.test(command)
  if (writesSomewhere && outsideRepo) {
    return deny(
      event,
      "Scratch files belong inside the repository, where the next step and the next agent can still find them.",
      "Write under `$REPO_ROOT/.opencode/.tmp/`, or the workflow runtime's own `/tmp/gh-aw/`.",
    )
  }
}

function checkWritePath(event, target, root) {
  if (typeof target !== "string" || !target) return
  if (!path.isAbsolute(target)) return
  // Windows hands back mixed drive-letter case, so compare case-insensitively
  // there and exactly everywhere else.
  const normalize = value => (process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value))
  const resolved = normalize(target)
  const base = normalize(root)
  if (resolved === base || resolved.startsWith(base + path.sep)) return
  return deny(
    event,
    `\`${target}\` is outside the repository, so nothing else in the run can see it and nobody will clean it up.`,
    "Write under `$REPO_ROOT/.opencode/.tmp/` instead.",
  )
}

function checkHost(event, url) {
  if (typeof url !== "string" || !url) return
  let host = ""
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return
  }
  const cliOnly = CLI_ONLY_HOSTS.find(candidate => host === candidate || host.endsWith(`.${candidate}`))
  if (cliOnly) {
    return deny(
      event,
      `${cliOnly} data must come from its CLI (\`gh\`, \`az\`, \`glab\`, \`acli\`), which is authenticated and returns structured output. A page fetch returns whatever HTML the browser would see.`,
      "Use the platform CLI. If it is unavailable, report that as a blocker.",
    )
  }
}

function checkPlanReadOnly(event, command) {
  for (const segment of splitCommand(command)) {
    // `echo` and `cat` are inspection right up to the point a redirect turns
    // them into a write, so the redirect is checked before the allowlist.
    if (/(^|\s)>>?\s*\S/.test(segment) || /\btee\b/.test(segment)) {
      return deny(
        event,
        "The plan agent reads; a redirect writes to the tree.",
        "Switch to the build agent to make changes.",
      )
    }
    if (PLAN_ALLOWED.some(pattern => pattern.test(segment))) continue
    return deny(
      event,
      `The plan agent reads; it does not change the tree, and \`${segment.split(/\s+/)[0]}\` is not one of its inspection commands.`,
      "Switch to the build agent to make changes.",
    )
  }
}

function skillNames(content) {
  const abilities = content.match(/^## Abilities\s*\n([\s\S]*?)(?=^## |\s*$)/m)?.[1] ?? ""
  return [...abilities.matchAll(/@([a-z0-9][a-z0-9-]*)/gi)].map(match => match[1])
}

function transitiveSkillNames(content) {
  return [...content.matchAll(/skill\(["`]([a-z0-9][a-z0-9-]*)["`]\)/gi)].map(match => match[1])
}

async function readFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf-8")
  } catch {
    return ""
  }
}

async function requiredSkills(directory, agent) {
  const baseAgent = (agent ?? "").replace(TIER_SUFFIX, "")
  const agentPath = path.join(directory, ".opencode", "agents", `${baseAgent}.md`)
  const guardrailsPath = path.join(directory, ".agents", "skills", GUARDRAILS_SKILL, "SKILL.md")
  const [agentContent, guardrailsContent] = await Promise.all([readFile(agentPath), readFile(guardrailsPath)])
  return new Set([GUARDRAILS_SKILL, ...skillNames(agentContent), ...transitiveSkillNames(guardrailsContent)])
}

// Only skills that exist on disk can gate work. An `@skill` reference to
// something uninstalled would otherwise be unloadable and deadlock the worker,
// which is a worse failure than the dangling reference itself.
async function installedSkills(directory, names) {
  const present = new Set()
  await Promise.all([...names].map(async name => {
    try {
      await fs.access(path.join(directory, ".agents", "skills", name, "SKILL.md"))
      present.add(name)
    } catch {
      // not installed; the reminder still names it, the gate ignores it
    }
  }))
  return present
}

async function detectDefaultBranch(root) {
  const fromRemote = await run("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], { cwd: root })
    .then(result => result.stdout.trim().replace(/^origin\//, ""))
    .catch(() => "")
  if (fromRemote) return fromRemote
  return run("git", ["config", "--get", "init.defaultBranch"], { cwd: root })
    .then(result => result.stdout.trim() || "main")
    .catch(() => "main")
}

async function readBacklogPlatform(root) {
  const raw = await readFile(path.join(root, ".opencode", "harness.json"))
  try {
    return JSON.parse(raw)?.platform?.backlog ?? "none"
  } catch {
    return "none"
  }
}

function reminder(missing) {
  const skills = [...missing].map(name => `\`${name}\``).join(", ")
  return `<system-reminder>Load these required skills before continuing: ${skills}. Guardrails first. A loaded skill can require further loads; follow those too. Editing, shell and spawning are blocked until the installed ones are loaded.</system-reminder>`
}

export default Plugin.define({
  id: "pc.system-reminders",
  async setup(ctx) {
    const root = ctx.location.directory || process.cwd()
    const sessions = new Map()
    let defaultBranch
    let backlogPlatform

    async function stateFor(sessionID, agent) {
      const state = sessions.get(sessionID)
      if (state?.agent === agent) return state
      const required = await requiredSkills(root, agent)
      const next = {
        agent,
        required,
        present: await installedSkills(root, required),
        // A session can switch agent (plan <-> build). What has been loaded is a
        // property of the session, not the agent, so it carries across.
        loaded: state?.loaded ?? new Set(),
      }
      sessions.set(sessionID, next)
      return next
    }

    function missingFor(state) {
      return [...state.required].filter(name => !state.loaded.has(name) && state.present.has(name))
    }

    // System instructions that name the trust boundary and, until the session's
    // required skills are loaded, that work is blocked. V2 applies this to every
    // request through the agent loop, which is at least as strong as the V1
    // message-transcript injection it replaces.
    await ctx.session.hook("context", async event => {
      try {
        event.system.push({ type: "text", text: TRUST_REMINDER })
        const state = await stateFor(event.sessionID, event.agent)
        const missing = missingFor(state)
        if (missing.length > 0) event.system.push({ type: "text", text: reminder(missing) })
      } catch (error) {
        console.error(`[harness] reminder hook failed open: ${error?.message}`)
      }
    })

    await ctx.permission.hook("evaluate", async event => {
      try {
        const state = await stateFor(event.sessionID, event.agent)

        // Skill activation is how the gate learns a skill was loaded. V2 routes
        // skill use through the `skill` action (resource = skill ID); an allow
        // decision still runs this hook, so it is the observation point.
        if (event.action === "skill") {
          for (const resource of event.resources) state.loaded.add(resource)
          return
        }

        if (GATED_ACTIONS.has(event.action)) {
          const missing = missingFor(state)
          if (missing.length > 0) {
            deny(
              event,
              `Required skills are not loaded yet: ${missing.map(name => `\`${name}\``).join(", ")}.`,
              `Call skill(${JSON.stringify(missing[0])}) first, guardrails first. Editing, shell and spawning stay blocked until then.`,
            )
            return
          }
        }

        if (event.action === "edit") {
          for (const resource of event.resources) {
            if (checkWritePath(event, resource, root)) return
          }
        }

        if (event.action === "webfetch") {
          for (const resource of event.resources) {
            backlogPlatform ??= await readBacklogPlatform(root)
            if (checkHost(event, resource)) return
          }
        }

        if (event.action === "shell") {
          const command = event.resources.join(" && ")
          if (!command) return

          if ((state.agent ?? "").replace(TIER_SUFFIX, "") === "plan") {
            if (checkPlanReadOnly(event, command)) return
          }
          if (checkGit(event, command)) return
          if (checkScratch(event, command)) return
          if (/\bgit\s+push\b/.test(command)) {
            defaultBranch ??= await detectDefaultBranch(root)
            if (await checkPush(event, command, root, defaultBranch)) return
          }
        }
      } catch (error) {
        // A bug in this guard must never break the session it is guarding.
        console.error(`[harness] guard failed open on ${event.action}: ${error?.message}`)
      }
    })

    console.error("[pc-system-reminders] guardrails active (V2 permission hooks registered)")
  },
})
