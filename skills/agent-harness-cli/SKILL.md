---
name: agent-harness-cli
description: Drive the agent-harness CLI - install the harness into a repository, bring an existing one up to date, set up a teammate's machine, or rerun a single step. Load when asked to install, update, or repair the agent harness, when a repo needs AI/agent scaffolding set up, or when a command like `npx @plainconceptsplatform/agent-harness` fails and needs diagnosing.
license: MIT
---

# agent-harness CLI

`agent-harness` installs a **harness** into a repository and keeps it current. The harness is the set of files agents work from: slash commands, `pc-*` skills, an agent team, OpenCode plugins, an OpenSpec workspace, and generated `ARCHITECTURE.md` / `DESIGN.md`.

Everything runs against the **current working directory**. `cd` into the target repository first; there is no `--path` flag.

## Pick the right verb

Read the repo before running anything. `.opencode/harness.json` is the marker for "harness already installed".

| Situation | Command |
| --- | --- |
| No `.opencode/harness.json` | `npx @plainconceptsplatform/agent-harness@latest` — the install wizard |
| Harness present, want the latest release's files | `npx @plainconceptsplatform/agent-harness@latest update` |
| Harness present, new machine or new teammate | `npx @plainconceptsplatform/agent-harness join` |
| One specific thing needs redoing | a single step command, see below |

Requires Node.js 18+.

## The install wizard is interactive

The wizard asks about source scope, backlog and repository platform, three models, and optional token-optimization tools. **Do not run it in a non-interactive shell** — it will hang or abort. If you cannot present prompts to a human, say so and hand the command to the user rather than trying to drive it.

Everything else (`update`, and the single-step commands other than `platform`, `models`, `optimization`) runs without prompts.

## Single-step commands

Run one step without the full wizard. Each reuses context from `.opencode/harness.json` when it needs to.

```
clean           Remove pre-existing AI files (AGENTS.md, .cursorrules, CLAUDE.md, ...)
platform        Choose backlog + repository platform
copy            Copy agents, skills, commands, docs into the repo
openspec        Initialize the OpenSpec workspace
models          Choose plan / build / fast models
optimization    Configure RTK, quota, Simple English, codegraph, agentmemory, humanizer
browser         Install the opencode-browser plugin
metadata        Rewrite .opencode/harness.json
```

`metadata` last if you ran several — it refreshes the config the others read.

## What lands in the repo

```
.opencode/
  harness.json            harness config: platform, models, agents.maxConcurrent
  harness-managed.json    hash per managed file, so update spares your edits
  harness.user.json       per-developer model override (gitignored)
  harness-run.json        live subagent wave state (gitignored)
  commands/               slash commands
  plugins/                pc-subagent-monitor, pc-subagent-tiers, pc-system-reminders
  agents/                 fullstack-engineer + user-created *-engineer files
.agents/skills/           pc-* skills
AGENTS.md ARCHITECTURE.md DESIGN.md
```

After a fresh install, the next move is `/repo-initialize` inside OpenCode — that is what generates real `ARCHITECTURE.md` and `DESIGN.md` and activates the agent team. Installing the harness alone does not do it.

## `update` is edit-safe

`update` compares each managed file against the hash recorded in `.opencode/harness-managed.json`. Files you changed by hand are left alone and reported as preserved. Generated skills — `pc-guardrails-project`, `pc-merge-risk-assess` — are never overwritten once populated. So `update` is safe to run repeatedly, and a second consecutive run should report no changes.

## Diagnosing failures

**"This project was set up by opencode-onboard v1"** — the repo has v1 state files or `ob-*` skills. v2 renamed both and does not migrate. Re-onboard on a clean branch; do not try to rename the files by hand, because the marker comments inside the installed skills changed too.

**"No config found. Run the wizard first."** — `update` or a step needs `.opencode/harness.json` and it is absent. Run the wizard.

**A platform step reports nothing and changes nothing** — platform content is injected into `<!-- PC-PLATFORM-*-START/END -->` marker pairs. If a marker pair is missing from the target file, injection is skipped silently. Check the markers exist before concluding the step worked.

**Skills missing after install** — skill installation ends with `npx skills experimental_install --yes`, run once at the end of the optimization step. If it failed, rerun it directly in the repo.

**Platform CLI warnings** — the harness expects `gh` (GitHub), `az` + azure-devops extension (Azure DevOps), `acli` (Jira), `glab` (GitLab), each authenticated. These are warnings, not fatal; the harness installs, but the matching `/ops-*` flows will not work until the CLI is present.

## Rules

- Never edit `.opencode/harness.json` by hand to change models. Use `/make-user-model <tier> <model>` inside OpenCode, or the `models` step.
- Never commit `harness.user.json` or `harness-run.json`. Both belong in `.opencode/.gitignore`, which `join` verifies.
- `clean` deletes files. Confirm with the user before running it on a repo that already has AI configuration worth keeping.
