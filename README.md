<div align="center">

<img src="https://raw.githubusercontent.com/PlainConceptsPlatform/opencode-onboard/refs/heads/main/docs/public/assets/logo.png" alt="opencode-onboard" width="160" />

# 🧰 opencode-onboard

**Prepare any codebase for AI. Wires [OpenCode](https://opencode.ai), [OpenSpec](https://github.com/fission-ai/openspec), [codegraph](https://github.com/colbymchenry/codegraph), and [agentmemory](https://github.com/rohitg00/agentmemory) into a multi-agent development workflow powered by native parallel subagents.**

GitHub, Azure DevOps, Jira, GitLab, browser-based backlog, or combinations (for example, Jira backlog plus GitHub repository, or browser backlog plus GitLab repository).

**[plainconceptsplatform.github.io/opencode-onboard](https://plainconceptsplatform.github.io/opencode-onboard)**

[![npm version](https://img.shields.io/npm/v/@plainconceptsplatform/opencode-onboard?style=flat-square&color=black)](https://www.npmjs.com/package/@plainconceptsplatform/opencode-onboard)
[![npm downloads](https://img.shields.io/npm/dm/@plainconceptsplatform/opencode-onboard?style=flat-square&color=black)](https://www.npmjs.com/package/@plainconceptsplatform/opencode-onboard)
[![license](https://img.shields.io/npm/l/@plainconceptsplatform/opencode-onboard?style=flat-square&color=black)](./LICENSE)
[![node](https://img.shields.io/node/v/@plainconceptsplatform/opencode-onboard?style=flat-square&color=black)](https://nodejs.org)

</div>

## What is this?

Most codebases have no `AGENTS.md`, no architecture documentation that agents can read, and no defined workflow for picking up tasks. Agents end up improvising, producing inconsistent results.

**opencode-onboard** fixes that in a single interactive wizard. It configures OpenCode with OpenSpec for structured change management, native subagent waves for parallel agent execution, codegraph for code intelligence, and agentmemory for shared context across agent sessions. It also installs an agent team, platform skills, and slash commands: everything agents need to plan, implement, and ship.

<div align="center">
<img src="https://raw.githubusercontent.com/PlainConceptsPlatform/opencode-onboard/refs/heads/main/docs/public/assets/demo.gif" alt="opencode-onboard demo" width="700" />
</div>

## Quick start

```bash
npx @plainconceptsplatform/opencode-onboard@latest
```

Requires **Node.js 18 or higher**.

### Run specific steps

You can run individual setup or maintenance steps without running the full wizard:

```bash
# Run one step directly
npx @plainconceptsplatform/opencode-onboard clean
npx @plainconceptsplatform/opencode-onboard platform
npx @plainconceptsplatform/opencode-onboard copy
npx @plainconceptsplatform/opencode-onboard openspec
npx @plainconceptsplatform/opencode-onboard models
npx @plainconceptsplatform/opencode-onboard optimization
npx @plainconceptsplatform/opencode-onboard browser
npx @plainconceptsplatform/opencode-onboard metadata
npx @plainconceptsplatform/opencode-onboard join

# Show CLI help and all commands
npx @plainconceptsplatform/opencode-onboard --help
npx @plainconceptsplatform/opencode-onboard -h
```

When available, step commands reuse context from `.opencode/opencode-onboard.json`.

Typical flow for reruns:

- Run `clean` if you want to reset old AI files
- Run `copy` if templates or skills changed in a new onboard release
- Run `optimization` if you want to reconfigure RTK, quota, Simple English, codegraph, agentmemory, or humanizer, and the guardrails optimization markers
- Run `metadata` last to refresh `.opencode/opencode-onboard.json`
- Run `join` if you are a new member of an existing onboarded project and want to sync the latest onboarding metadata

---

## How it works

The CLI runs a 10-step onboarding wizard. It keeps the current step visible, plus the last two completed steps, so progress is always clear.

| Step | What happens |
| --- | --- |
| **1. Source scope** | Choose current repository or sibling source roots for code analysis |
| **2. Clean AI files** | Detects existing `AGENTS.md`, `.cursorrules`, `CLAUDE.md`, `.agents/` and so on, then removes them. Preserves your `.agents/skills/` directory. |
| **3. Choose platform** | Backlog (GitHub, Azure DevOps, Jira, browser-based, or None) plus repository (GitHub, Azure DevOps, GitLab, or None). Supports mixed platforms, for example browser backlog plus GitHub repository, or Jira backlog plus GitLab repository. |
| **4. Check platform CLI** | Verifies `gh` (GitHub), or `az` plus `azure-devops` extension (Azure DevOps), or `acli` (Jira), or `glab` (GitLab). Skips CLI checks for browser-based or None platforms. |
| **5. Copy scaffolding** | Copies agents, built-in skills, bootstrap documentation, writes source-roots metadata, applies AGENTS bootstrap patching, copies `skills-lock.json`, then runs `npx skills` |
| **6. Initialize OpenSpec** | Runs `npx @fission-ai/openspec init` silently for structured change management |
| **7. Choose models** | Fetches live model list from [models.dev](https://models.dev), lets you pick plan, build, and fast models with cost indicators and canonical pricing |
| **8. Token optimization tools** | Optional and recommended. One checklist step for RTK check, opencode-quota setup, Simple English install, codegraph install, agentmemory install, humanizer install, and token-optimization rule injection into guardrails |
| **9. Install browser plugin** | Installs `@different-ai/opencode-browser` globally for agent browser automation |
| **10. Write onboarding metadata** | Writes `.opencode/opencode-onboard.json` with selected setup details |

When it finishes, open OpenCode in your project and type:

```
/repo-initialize
```

OpenCode asks if this is a greenfield or brownfield project. For brownfield projects it generates `ARCHITECTURE.md` and `DESIGN.md` from your actual codebase, archives project history, then activates the full agent team. For greenfield projects it skips documentation generation and leaves placeholder files you can populate later with `/make-architecture` and `/make-design`.

---

## Commands

Custom slash commands are installed into `.opencode/commands/` and are available directly in OpenCode.

Commands that other commands (or agents) need to execute are thin wrappers around `ob-*` skills in `.agents/skills/` — the command handles user invocation and arguments, the skill holds the procedure. OpenCode has no mechanism for a command to run another command, but any agent can load a skill mid-conversation, which is what makes pipelines like `/plan-goal` composable.

| Command | Description |
| ------- | ----------- |
| `/repo-help` | Show all commands and when to use each one. Start here if you are unsure. |
| `/repo-onboard` | Guided tour of the project and its agentic infrastructure. Explains agents, commands, skills, OpenSpec workflow, and configuration. Read-only. |
| `/repo-audit` | Read-only audit of every configured source root against fullstack abilities and guardrails. Reports prioritized architecture, quality, dependency, lockfile, tooling, and CI findings. |
| `/repo-initialize` | Initialize the project. Asks greenfield versus brownfield, then activates the agent team. |
| `/plan-explore` | Think through an idea or investigate a problem before committing to a plan. |
| `/plan-propose <url or idea>` | Parse a GitHub Issue, Azure DevOps, Jira, or browser URL, or a direct idea, into a structured plan (proposal, specs, tasks). Enriches each task with agent and model assignments. |
| `/plan-quick <task>` | Quick plan for focused changes. Reads the codebase, creates a task checklist in the Todo pane, and stops. No OpenSpec, no proposals, no specs. |
| `/plan-apply` | Implement tasks from the current plan. Detects format automatically: OpenSpec-annotated tasks run as parallel subagent waves; plain checkboxes run sequentially in-session. |
| `/ops-ship` | Create a pull request for the current branch with screenshots if the user interface changed. |
| `/ops-review` | Read and triage pull request review feedback. Reports what needs fixing. |
| `/ops-backlog` | Create an issue in the backlog platform (GitHub, Azure DevOps, or Jira) from a description. |
| `/ops-evidence` | Produce evidence a change works (delegating to a project harness if present, else a screenshot), write `evidence/evidence.json`, and publish an idempotent comment on the issue/PR. Best-effort. |
| `/make-evidence-scaffold` | One-time scaffold of a project-specific visual-evidence harness (deterministic capture + assertions + manifest + publisher) that `/ops-evidence` and `/plan-goal` then delegate to. |
| `/plan-archive` | Archive a completed OpenSpec change. |
| `/plan-goal <feature or URL>` | Autonomous, no-confirmation pipeline: branch off main, then explore, propose, apply, archive (one commit per phase). Default mode: merge to main and delete the feature branch. Add `branch` keyword to keep the feature branch without merging. Never pushes. For loop-engineering. |
| `/make-engineer` | Interactive persona-driven form to add a custom specialist engineer. Pick a persona, then confirm an inspected-and-recommended skill set (architecture/patterns like FSD or design patterns, framework, testing, infra) before it installs. |
| `/make-architecture` | Generate or regenerate `ARCHITECTURE.md` from the codebase. |
| `/make-design` | Generate or regenerate `DESIGN.md` from the design system. |
| `/make-guardrails` | Generate a `ob-guardrails-project` skill from `ARCHITECTURE.md` and project config files. Extracts architecture boundaries, naming, code style, testing, and git workflow rules. Updates all `*-engineer.md` to load the skill. |
| `/repo-verify` | Verify and repair current-branch changes against applicable fullstack abilities and dependency/lockfile rules, while always running immutable dependency installs/restores, configured builds, and tests for every discovered project. Runs automatically in `/plan-goal`. |
| `/make-user-model [user] <tier> <model>` | Set the model for a tier (`plan`, `build`, `fast`). Writes to `opencode-onboard.json` (team) or `opencode-onboard.user.json` (user override, gitignored) when `user` prefix is used. Restart to pick up changes: the `ob-subagent-tiers` plugin rebuilds tier agents at startup. Pass a model id or `current` for the active session model. |

---

## Agents and Skills

opencode-onboard draws a hard line between two concepts:

### Agents, universal behaviors

Agents define _how to work_. They are universal personas (same behavior across projects and stacks).

Current baseline uses a generic execution model:

```
lead                   lead/orchestrator, planning, pull request lifecycle
fullstack-engineer     primary planning agent, accumulates all skills (user-facing, not spawned)
*-engineer             user-created specialists, spawned by the lead for parallel implementation
```

`fullstack-engineer` is `mode: primary` — it's the user's planning session agent, not a spawned worker. Project-specific specialization comes from user-created custom engineers via `/make-engineer`. During `/plan-apply`, the lead inspects the engineers that actually exist in `.opencode/agents/` and spawns matching specialists. `fullstack-engineer` is never assigned to tasks — if no specialist matches, the user should create one.

### Skills, platform knowledge

Skills define _what to know_. They provide project rules, platform behavior, and task-specific execution guidance. Agents auto-detect and load relevant skills; **you do not manually choose skills per prompt**.

If you choose backlog platform `None`, no userstory skills are injected into the workflow. The project works from direct conversation, local repository context, and optional OpenSpec artifacts only. If you choose repository platform `None`, no pull request skills are injected.

Current loading model:

- `ob-guardrails-generic` is mandatory baseline for every agent (git, secrets, quality rules, plus the engineer workflow)
- Baseline context rules and token-optimization guidance live in `AGENTS.md` (always in context), not in a skill

Default `fullstack-engineer` abilities:

```
## Abilities
- Guardrails: @ob-guardrails-generic, @ob-guardrails-project
```

Users are expected to create additional skills and map them into abilities over time.

Built-in skills (`ob-` prefix) shipped with opencode-onboard:

| Skill | Purpose |
| ----- | ------- |
| `ob-guardrails-generic` | Foundation for user guardrails skills |
| `ob-guardrails-project` | Project-specific guardrails, populated by `/make-guardrails` |
| `ob-userstory-gh` | Parse a GitHub Issue URL into a structured work item |
| `ob-userstory-az` | Parse an Azure DevOps work item URL |
| `ob-userstory-jira` | Parse a Jira issue URL via `acli` CLI |
| `ob-userstory-browser` | Parse work item from any URL via browser automation (Linear, Trello, and so on) |
| `browser-automation` | Browser control via `@different-ai/opencode-browser` (localhost and browser backlog exception) |
| `ob-plan-explore` | Read-only exploration procedure behind `/plan-explore`; autonomous mode used by `/plan-goal` |
| `ob-plan-propose` | Proposal + task-enrichment procedure behind `/plan-propose`; autonomous mode used by `/plan-goal` |
| `ob-plan-apply` | Wave-implementation procedure behind `/plan-apply`; autonomous mode used by `/plan-goal` |
| `ob-plan-archive` | Archive procedure behind `/plan-archive` (platform flow injected at onboarding); autonomous mode used by `/plan-goal` |
| `ob-ops-ship` | PR-creation procedure behind `/ops-ship` (platform flow injected at onboarding); used by `/plan-goal` pr mode |
| `ob-ops-evidence` | Evidence of a change → `evidence/evidence.json` (passed/skipped/failed/blocked) + idempotent verified issue/PR comment; delegates to a project harness if present, else screenshots; used by `/ops-evidence` and `/plan-goal` |
| `ob-make-architecture` | ARCHITECTURE.md generation behind `/make-architecture`; used by `/repo-initialize` |
| `ob-make-design` | DESIGN.md generation behind `/make-design`; used by `/repo-initialize` |
| `ob-make-guardrails` | Guardrails generation behind `/make-guardrails`; used by `/repo-initialize` |
| `ob-make-engineer` | Custom engineer creation behind `/make-engineer` |
| `ob-make-evidence-scaffold` | Visual-evidence harness scaffold behind `/make-evidence-scaffold` |
| `ob-make-user-model` | Tier model configuration behind `/make-user-model` |
| `ob-plan-goal` | Autonomous full-lifecycle pipeline behind `/plan-goal` |
| `ob-plan-quick` | Quick task checklist behind `/plan-quick` |
| `ob-repo-audit` | Read-only health audit across configured source roots and fullstack abilities |
| `ob-repo-verify` | Current-branch verification and repair gate used by `/repo-verify` and `/plan-goal` |
| `ob-repo-initialize` | Project initialization behind `/repo-initialize` |
| `ob-repo-onboard` | Guided project tour behind `/repo-onboard` |
| `ob-repo-help` | The command reference displayed by `/repo-help`; used by `/repo-initialize` |

Platform operations are injected during onboarding: pull request creation into the `ob-ops-ship` skill (loaded by `/ops-ship` and `/plan-goal`), archive PR flow into the `ob-plan-archive` skill, issue/work-item evidence comments into the `ob-ops-evidence` skill (backlog platform), and pull request review / issue creation directly into the `/ops-review` and `/ops-backlog` command files.

Skills live in `.agents/skills/`. Any `SKILL.md` file in a subdirectory is automatically discoverable. Write your own and agents will pick them up.

### Models, plan / build / fast

During onboarding you pick three models:

| Role | Used by | Pick |
| ---- | ------- | ---- |
| **plan** | Main OpenCode session (the lead) | Something capable with strong reasoning |
| **build** | Specialist engineers (default tier) | Something capable for implementation |
| **fast** | Light helpers (fast tier) | Something fast and cheap |

Models are fetched live from [models.dev](https://models.dev) (3000+ models, cached weekly). Cost tiers `[$]` `[$$]` `[$$$]` always reflect the canonical provider price, so `github-copilot/claude-opus-4.7` shows `[$$]` not `[$]`.

---

## The pipeline

When you give the lead agent a work item URL, execution follows this pipeline. If backlog platform is `None`, skip the work item stage. If repository platform is `None`, skip the pull request stage:

```
lead
                   ↓
          parse work item via userstory skill
                   ↓
               plan-propose
         proposal + specs + tasks
                   ↓
              [confirm with user]
                   ↓
   wave of subagents (*-engineer, per-tier model)
  each implements its assigned tasks → returns result → lead commits group
                   ↓
        verify (tests, build, lint as needed)
                   ↓
     lead (ship mode, if configured)
   commit → push → pull request → feedback loop
```

1. Load the platform userstory skill (installed as `ob-userstory`, from the variant matching your backlog platform)
2. Run `/plan-propose` to produce `proposal.md`, specs, and `tasks.md`
3. Confirm with user before implementation
4. Run `/plan-apply` to orchestrate implementation in waves
5. Each wave spawns engineers in parallel (custom `*-engineer` specialists, each carrying its own tier model), capped at `agents.maxConcurrent`
6. Each subagent receives its task IDs in its prompt, loads relevant abilities, implements, and returns; the lead commits each group
7. Verify with tests, build, and lint according to task scope
8. Ship or update pull request via lead flow

For unattended Loop Task runs, keep a concrete shell verification task as the final exit-code gate. `/repo-verify` runs inside `/plan-goal` first, applying fullstack abilities, every discovered project's immutable dependency install or restore, configured build and test commands, and change-aware repair checks; the shell task independently proves the critical commands passed before commit or pull request actions.

Agents run as native OpenCode subagents in parallel waves: no external plugin, no git worktrees. The lead's Todo pane is the live board, and the `ob-subagent-monitor` plugin mirrors state to `.opencode/.ob-run.json`. Navigate into any running subagent with `ctrl+x ↓` then `←`/`→`.

---

## What gets installed

```
your-project/
├── AGENTS.md                        ← bootstrap mode, replaced after first "/repo-initialize"
├── ARCHITECTURE.md                  ← prompt for agents to fill in from your codebase
├── DESIGN.md                        ← prompt for agents to fill in from your codebase
├── .opencode/
│   ├── opencode.json                ← default model + plugin config
│   ├── opencode-onboard.json        ← onboarding metadata + runtime config (models, maxConcurrentAgents)
│   ├── agents/                      ← fullstack-engineer (primary, planning) + user-created *-engineer files
│   ├── tui.json                     ← registers the Subagents sidebar panel
│   ├── tui/
│   │   └── ob-subagents.tsx         ← TUI plugin: live Subagents panel in the sidebar
│   └── plugins/
│       ├── ob-subagent-monitor.js   ← server plugin: writes subagent state → .opencode/.ob-run.json
│       └── ob-system-reminders.js   ← loads every agent ability and its mandatory transitive skills
└── .agents/
    └── skills/
        ├── ob-guardrails-generic/  ← foundation for user guardrails
        ├── ob-guardrails-project/  ← populated by /make-guardrails
        ├── ob-userstory/           ← the variant matching your backlog platform, renamed on install
        └── browser-automation/
```

Platform skills ship as suffixed variants (`ob-userstory-gh`, `ob-userstory-az`, `ob-userstory-jira`, `ob-userstory-browser`) and the installer copies only the matching one, renamed to its generic name. Platform operations (ship, review, backlog) are injected directly into the `/ops-*` command files from `src/presets/ops-*/` during onboarding. Source-roots metadata lands in `.opencode/source-roots.json`. The always-shipped reminder plugin loads every agent ability, guardrails first, and repeats mandatory skill loads after compaction. Token-optimization guidance is injected into `ob-guardrails-generic` marker blocks during onboarding.

---

## The bootstrap sequence

The first time you type `init` in OpenCode after onboarding, the agent asks whether this is a **greenfield** or **brownfield** project:

### Brownfield (existing codebase)

1. Bootstrap-mode `AGENTS.md` triggers the initialization workflow
2. OpenCode archives existing project context into OpenSpec (`project-history`)
3. OpenCode runs `/make-architecture` to generate real `ARCHITECTURE.md` from your codebase
4. OpenCode runs `/make-design` to generate real `DESIGN.md` from your design system
5. OpenSpec `config.yaml` is populated with discovered tech stack and domain context
6. Bootstrap `AGENTS.md` is replaced with production guidance
7. Team workflows become fully active for normal implementation tasks

### Greenfield (new project, little or no existing code)

1. Bootstrap-mode `AGENTS.md` triggers the initialization workflow
2. OpenSpec `config.yaml` is populated with what is known (intended stack, domain)
3. Bootstrap `AGENTS.md` is replaced with production guidance
4. `ARCHITECTURE.md` and `DESIGN.md` are left as placeholder files

Once your codebase has meaningful content, run:
- `/make-architecture` to generate architecture documentation
- `/make-design` to generate design system documentation

Both commands are safe to rerun at any time as the project evolves.

---

## Token Budget Controls

Long unattended agent sessions can consume significant tokens. Set these controls up **before** first use:

1. **Set provider-side limits first**: monthly soft-limit plus hard usage cap in your provider dashboard:
   - OpenAI: [platform.openai.com/account/limits](https://platform.openai.com/account/limits)
   - Anthropic: [console.anthropic.com](https://console.anthropic.com)
   - Google AI Studio: [aistudio.google.com/app/usage](https://aistudio.google.com/app/usage)

2. **Route models by task type**: use a fast and cheap model (for example `haiku`, `gpt-4o-mini`) for orchestration and status loops; reserve expensive models (for example `sonnet`, `opus`, `gpt-4o`) for implementation tasks only.

3. **Install the quota plugin**: the [`@slkiser/opencode-quota`](https://www.npmjs.com/package/@slkiser/opencode-quota) plugin adds `/quota` and `/quota_status` commands that surface real-time token usage inside OpenCode sessions.

4. **Use `/quota` checkpoints**: run `/quota` before starting any `/plan-apply` session and after each agent wave. Pause at 75 percent consumed; stop at 90 percent.

5. **Confirm before large runs**: the onboarded `/plan-apply` workflow will ask for your confirmation before spawning agents for Medium (4 to 7 tasks) or High (8 or more tasks) scope sessions.

---

## Prerequisites

| Requirement | Notes |
| ----------- | ----- |
| **Node.js 18 or higher** | Required |
| **[OpenCode](https://opencode.ai)** | The agent runtime |
| **[gh CLI](https://cli.github.com)** | GitHub platform, must be authenticated |
| **[az CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)** plus azure-devops extension | Azure DevOps platform |
| **[acli](https://developer.atlassian.com/cloud/acli/guides/install-acli/)** | Jira (Atlassian) backlog platform, must be authenticated |
| **[glab](https://gitlab.com/gitlab-org/cli/#installation)** | GitLab repository platform, must be authenticated |

---

## Development

Wizard choices and defaults live in `src/presets/` where possible:

- `source.json` controls source-scope prompt options
- `platforms.json` controls platform labels, CLI checks, and backlog-only flags
- `clean.json` controls AI file detection and preservation
- `models.json` controls model role prompts and agent assignments
- `optimization.json` controls RTK, quota, Simple English, codegraph, agentmemory, and humanizer checklist defaults
- `quota.json` controls opencode-quota defaults
- `browser.json` controls opencode-browser installer automation

```bash
git clone https://github.com/PlainConceptsPlatform/opencode-onboard.git
cd opencode-onboard
pnpm install

# Run the CLI locally
node src/index.js

# Run tests
pnpm test

# Run linting
pnpm lint

# Fix auto-fixable lint issues
pnpm lint:fix

# Watch mode
pnpm test:watch
```

Tests are written with [Vitest](https://vitest.dev). Linting uses ESLint flat config with Node ESM defaults and stricter correctness rules.

---

## License

MIT © [Plain Concepts](https://github.com/PlainConceptsPlatform)
