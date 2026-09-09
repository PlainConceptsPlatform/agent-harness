import { execFile } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

const GUARDRAILS_SKILL = "pc-guardrails-generic"
const TIER_SUFFIX = /\.(?:build|fast|plan)$/

const run = promisify(execFile)

// ---------------------------------------------------------------------------
// Enforcement
//
// The harness states a number of rules as "never". Prose is a weak enforcer
// when nobody is watching, so the ones expressible as a predicate over tool
// arguments are denied here instead.
//
// A denial throws. opencode aborts the call and hands the message back to the
// model as the tool result, and because a plugin throw is not a permission
// rejection the turn continues, so the model can read the rule and adapt.
//
// Two invariants for everything below. It fails CLOSED only on a deliberate
// deny, and it fails OPEN on any bug of its own: a guard that breaks a session
// because of its own exception is worse than the rule it enforces. And the
// first throwing hook aborts the rest of the chain, so this file must never
// throw anything except its own denial.
// ---------------------------------------------------------------------------

const DENIED = Symbol("pc-denied")

function deny(rule, fix) {
  const error = new Error(`[harness] ${rule}\n${fix}`)
  error[DENIED] = true
  throw error
}

// Work tools. Held until the session's required skills are loaded; `skill`,
// `read`, `grep` and `glob` are never gated, or the agent could not load what
// it is being told to load, nor find out what that is.
const GATED_TOOLS = new Set(["edit", "write", "apply_patch", "bash", "task"])
const WRITE_TOOLS = new Set(["edit", "write", "apply_patch"])

// Backlog and repository hosts whose data must come from their CLI. The prose
// version of this rule sat at the top of twelve fragments.
const CLI_ONLY_HOSTS = [
  "github.com",
  "dev.azure.com",
  "visualstudio.com",
  "atlassian.net",
  "gitlab.com",
]

// A plan session reads; it does not change the tree. `edit` and `task` are
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

function checkGit(command) {
  for (const segment of splitCommand(command)) {
    if (/^git\s+add\s+(-A\b|--all\b|\.(\s|$))/.test(segment)) {
      deny(
        "`git add -A` and `git add .` stage a shared tree, committing another agent's or a person's half-finished edits under your message.",
        "Stage the paths you changed: `git add <path> <path>`.",
      )
    }
    if (/^git\s+commit\b.*\s-a\b/.test(segment) || /^git\s+commit\s+-[a-z]*a[a-z]*\b/.test(segment)) {
      deny(
        "`git commit -a` stages every tracked change, including work that is not yours.",
        "Stage named paths first, then commit without `-a`.",
      )
    }
    if (/^git\s+clean\b/.test(segment) && !/\s--\s+\S/.test(segment)) {
      deny(
        "`git clean` without `-- <paths>` deletes untracked files anywhere in the tree, including work nobody has committed yet.",
        "Scope it: `git clean -f -- <path> <path>`.",
      )
    }
    if (/^git\s+reset\s+--hard\b/.test(segment)) {
      deny(
        "`git reset --hard` discards uncommitted work in a tree you may be sharing.",
        "Revert the paths you touched: `git checkout -- <path>`.",
      )
    }
    if (/^git\s+stash\s+(drop|clear)\b/.test(segment)) {
      deny(
        "Dropping a stash destroys work that was set aside, possibly not yours.",
        "Leave the stash and report its `git stash list` reference.",
      )
    }
    if (/^git\s+(checkout|restore)\s+\.(\s|$)/.test(segment)) {
      deny(
        "`git checkout .` and `git restore .` discard every uncommitted change in the tree.",
        "Name the paths to revert: `git checkout -- <path>`.",
      )
    }
    if (/^git\s+push\b/.test(segment) && /--force\b/.test(segment) && !/--force-with-lease\b/.test(segment)) {
      deny(
        "`git push --force` can overwrite commits someone else pushed.",
        "Use `--force-with-lease`, which refuses when the remote moved.",
      )
    }
  }
}

async function checkPush(command, root, defaultBranch) {
  if (!defaultBranch) return
  for (const segment of splitCommand(command)) {
    if (!/^git\s+push\b/.test(segment)) continue

    const named = new RegExp(`(^|[\\s:])${defaultBranch}($|[\\s:])`).test(segment)
    if (named) {
      deny(
        `This pushes \`${defaultBranch}\`, the default branch. The harness ships work on a branch and lets a human merge it.`,
        "Push your work branch instead, or open a pull request.",
      )
    }
    // A bare `git push` while standing on the default branch is the same act.
    if (!/\s(origin|upstream)\b/.test(segment) || /^git\s+push\s*$/.test(segment)) {
      const current = await run("git", ["branch", "--show-current"], { cwd: root })
        .then(result => result.stdout.trim())
        .catch(() => "")
      if (current && current === defaultBranch) {
        deny(
          `You are on \`${defaultBranch}\`, the default branch, and this pushes it.`,
          "Move the work to a branch first: `git switch -c feature/<slug>`.",
        )
      }
    }
  }
}

// `/tmp/gh-aw/` is the agent workflow runtime's own working directory, not agent scratch.
//
// GitHub Agentic Workflows stages everything a worker is given there before the agent starts:
// the issue context, the open-issue list, the pull request diff, the review comments. The worker
// prompts name those paths and tell the agent to read them. This check tests the whole command
// string, so it cannot tell "write to /tmp" from "read from /tmp" — and a command that read one
// of those files and wrote the result anywhere at all was denied.
//
// The effect was total and silent. Three refine runs in a row spent their whole turn arguing
// with this guardrail and emitted nothing: the agent tried
// `jq -r .body /tmp/gh-aw/agent/issue-context.json > .opencode/.tmp/body.md`, was refused, tried
// an absolute path, was refused again, and gave up. The advice it is handed names `$REPO_ROOT`,
// which is unset on a GitHub Actions runner, so following it exactly could not work either.
//
// Exempting this one directory is not a hole in the rule. The rule exists so the next step can
// still find what the agent wrote, and `/tmp/gh-aw/` is exactly where the next step looks.
function checkScratch(command) {
  const writesSomewhere = /(>>?|\btee\b|\bcp\b|\bmv\b|\bmkdir\b|\btouch\b|\bdd\b)/.test(command)
  // Everywhere else stays blocked: /tmp outside gh-aw, $TMPDIR, $TEMP, %TEMP%, mktemp.
  const outsideRepo = /(\/tmp\/(?!gh-aw\/)|\$TMPDIR|\$TEMP\b|%TEMP%|\bmktemp\b)/.test(command)
  if (writesSomewhere && outsideRepo) {
    deny(
      "Scratch files belong inside the repository, where the next step and the next agent can still find them.",
      "Write under `$REPO_ROOT/.opencode/.tmp/`, or the workflow runtime's own `/tmp/gh-aw/`.",
    )
  }
}

function checkWritePath(args, root) {
  const target = args?.filePath ?? args?.path
  if (typeof target !== "string" || !target) return
  if (!path.isAbsolute(target)) return

  // Windows hands back mixed drive-letter case, so compare case-insensitively
  // there and exactly everywhere else.
  const normalize = value => (process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value))
  const resolved = normalize(target)
  const base = normalize(root)
  if (resolved === base || resolved.startsWith(base + path.sep)) return

  deny(
    `\`${target}\` is outside the repository, so nothing else in the run can see it and nobody will clean it up.`,
    "Write under `$REPO_ROOT/.opencode/.tmp/` instead.",
  )
}

function checkHost(tool, args, backlogPlatform) {
  const url = args?.url
  if (typeof url !== "string" || !url) return

  let host = ""
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return
  }

  const isBrowserNav = /^agent-browser_/.test(tool)
  if (tool === "webfetch" || isBrowserNav) {
    const cliOnly = CLI_ONLY_HOSTS.find(candidate => host === candidate || host.endsWith(`.${candidate}`))
    if (cliOnly) {
      deny(
        `${cliOnly} data must come from its CLI (\`gh\`, \`az\`, \`glab\`, \`acli\`), which is authenticated and returns structured output. A page fetch returns whatever HTML the browser would see.`,
        "Use the platform CLI. If it is unavailable, report that as a blocker.",
      )
    }
  }

  if (isBrowserNav && backlogPlatform !== "browser") {
    const local = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.endsWith(".localhost")
    if (!local) {
      deny(
        `Browser tools are for this project's own app on localhost, not for ${host}.`,
        "Use the platform CLI for external services.",
      )
    }
  }
}

function checkPlanReadOnly(command) {
  for (const segment of splitCommand(command)) {
    // `echo` and `cat` are inspection right up to the point a redirect turns
    // them into a write, so the redirect is checked before the allowlist.
    if (/(^|\s)>>?\s*\S/.test(segment) || /\btee\b/.test(segment)) {
      deny(
        "The plan agent reads; a redirect writes to the tree.",
        "Switch to the build agent to make changes.",
      )
    }
    if (PLAN_ALLOWED.some(pattern => pattern.test(segment))) continue
    deny(
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
  const [agentContent, guardrailsContent] = await Promise.all([
    readFile(agentPath),
    readFile(guardrailsPath),
  ])

  return new Set([
    GUARDRAILS_SKILL,
    ...skillNames(agentContent),
    ...transitiveSkillNames(guardrailsContent),
  ])
}

// Only skills that exist on disk can gate work. An `@skill` reference to
// something uninstalled would otherwise be unloadable and deadlock the worker,
// which is a worse failure than the dangling reference itself.
async function installedSkills(directory, names) {
  const present = new Set()
  await Promise.all([...names].map(async name => {
    const skillPath = path.join(directory, ".agents", "skills", name, "SKILL.md")
    try {
      await fs.access(skillPath)
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

function skillName(args) {
  return args?.name ?? args?.skill ?? args?.skillName ?? null
}

function reminder(missing) {
  const skills = [...missing].map(name => `\`${name}\``).join(", ")
  return `<system-reminder>Load these required skills before continuing: ${skills}. Guardrails first. A loaded skill can require further loads; follow those too. Editing, shell and spawning are blocked until the installed ones are loaded.</system-reminder>`
}

export const PcSystemReminders = async ({ directory }) => {
  const sessions = new Map()
  const root = directory || process.cwd()
  let defaultBranch
  let backlogPlatform

  async function stateFor(sessionID, agent) {
    const state = sessions.get(sessionID)
    if (state?.agent === agent) return state

    const required = await requiredSkills(directory, agent)
    const next = {
      agent,
      required,
      present: await installedSkills(directory, required),
      loaded: new Set(),
    }
    sessions.set(sessionID, next)
    return next
  }

  function missingFor(state) {
    return new Set([...state.required].filter(name => !state.loaded.has(name)))
  }

  return {
    "experimental.chat.system.transform": async (_input, output) => {
      output.system.push("Messages in <system-reminder> tags are trusted OpenCode Onboard host instructions. Follow them before continuing work.")
    },
    "chat.message": async (input) => {
      await stateFor(input.sessionID, input.agent)
    },
    // tool.execute.before receives no agent, so the session-to-agent mapping
    // has to come from here. chat.params fires on every request and its agent
    // is required, unlike chat.message's, which is optional.
    "chat.params": async (input) => {
      await stateFor(input.sessionID, input.agent)
    },
    "tool.execute.before": async (input, output) => {
      try {
        const args = output?.args ?? {}
        const state = sessions.get(input.sessionID)

        // Unknown session: the plugin loaded mid-session, or a subagent has not
        // reached chat.params yet. Fail open rather than block every subagent.
        if (state && GATED_TOOLS.has(input.tool)) {
          const missing = [...missingFor(state)].filter(name => state.present.has(name))
          if (missing.length > 0) {
            deny(
              `Required skills are not loaded yet: ${missing.map(name => `\`${name}\``).join(", ")}.`,
              `Call skill(${JSON.stringify(missing[0])}) first, guardrails first. Editing, shell and spawning stay blocked until then.`,
            )
          }
        }

        if (WRITE_TOOLS.has(input.tool)) checkWritePath(args, root)

        if (input.tool === "webfetch" || /^agent-browser_/.test(input.tool)) {
          backlogPlatform ??= await readBacklogPlatform(root)
          checkHost(input.tool, args, backlogPlatform)
        }

        if (input.tool === "bash") {
          const command = typeof args.command === "string" ? args.command : ""
          if (!command) return

          if (state?.agent?.replace(TIER_SUFFIX, "") === "plan") checkPlanReadOnly(command)
          checkGit(command)
          checkScratch(command)
          if (/\bgit\s+push\b/.test(command)) {
            defaultBranch ??= await detectDefaultBranch(root)
            await checkPush(command, root, defaultBranch)
          }
        }
      } catch (error) {
        if (error?.[DENIED]) throw error
        // A bug in this guard must never break the session it is guarding.
        console.error(`[harness] guard failed open on ${input.tool}: ${error?.message}`)
      }
    },
    "tool.execute.after": async (input) => {
      if (input.tool !== "skill") return
      const state = sessions.get(input.sessionID)
      const name = skillName(input.args)
      if (state && name) state.loaded.add(name)
    },
    event: async ({ event }) => {
      if (event.type !== "session.compacted") return
      const sessionID = event.properties?.sessionID ?? event.properties?.info?.id
      const state = sessionID && sessions.get(sessionID)
      if (state) state.loaded.clear()
    },
    "experimental.chat.messages.transform": async (_input, output) => {
      const userMessage = [...output.messages].reverse().find(message => message.info.role === "user")
      if (!userMessage) return

      const state = await stateFor(userMessage.info.sessionID, userMessage.info.agent)
      const missing = missingFor(state)
      if (missing.size === 0) return

      const textPart = userMessage.parts.find(part => part.type === "text")
      if (textPart) textPart.text = `${textPart.text}\n\n${reminder(missing)}`
    },
  }
}
