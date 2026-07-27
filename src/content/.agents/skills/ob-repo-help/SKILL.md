---
name: ob-repo-help
description: The full command reference for this project - every /command with when to use it and the typical workflows. Load when the user asks for help, the command list, or at the end of repo initialization. Invoked by the /repo-help command and the repo-initialize flow.
license: MIT
---

# Repo Help

Display the following reference to the user exactly as written. Do not summarize.

## Commands

### Not sure where to start?

**`/init`** (alias: `/repo-initialize`): Initialize the project. Presents a single form with all setup questions (project type, history, architecture, design, evidence), then executes the selected steps.

**`/repo-onboard`**: Guided tour of the project and its agentic infrastructure. Explains agents, commands, skills, OpenSpec workflow, and configuration. Read-only: no files modified.

**`/repo-audit`**: Read-only health audit of every configured source root. Loads the fullstack engineer's abilities, checks guardrails, architecture, tooling, dependencies, lockfiles, tests, and CI, then reports prioritized findings.

**`/plan-explore`**: Your backlog is unclear, you have a half-formed idea, or you need to think through a problem before committing to a plan. This is a thinking partner, not an executor.

**`/plan-story <feature or need>`**: Write a detailed, repo-aware user story from a feature idea. Loads the `@user-story` skill (Mike Cohn format + Gherkin acceptance criteria), analyzes your codebase for concrete context, and produces a development-ready story with specific personas, real outcomes, and testable criteria grounded in your actual file paths, component names, and data models. No files written — just the story.

**`/plan-propose <url or idea>`**: You have a work item URL, or a clear idea and you want to turn it into a structured plan (proposal, specs, tasks). Enriches each task with the best matching agent and model before showing you the plan. Nothing is implemented until you confirm.

---

### Ready to implement?

**`/plan-quick <task>`**: Quick plan for focused changes. Reads the codebase, creates a task checklist in the Todo pane. No files, no OpenSpec. Then you decide: `/plan-apply` to implement, or `/plan-propose` for a full OpenSpec plan.

**`/plan-apply`**: Implement a plan. Detects the source automatically: OpenSpec-annotated tasks (from `/plan-propose`) run as parallel subagent waves; Todo pane tasks (from `/plan-quick`) run sequentially in-session.

**`/plan-goal <feature or URL>`**: Fully autonomous, no confirmations. Branches off `main`, then runs propose → apply → archive on that branch (each phase its own commit). Default: merges to `main` and deletes the branch. Add `push` keyword to push the branch only. Add `pr` keyword to push + create a PR. Built for loop-engineering / unattended runs. Stops only on a hard failure, leaving the branch unmerged.

---

### Done implementing?

**`/ops-ship`**: Create a PR for the current feature branch with screenshots if UI changed.

**`/ops-review`**: Read and triage PR review feedback. If you share a PR URL or say "I've added comments to the PR", it reads and classifies the review comments so you know what to fix. Fixing is done via `/plan-apply`.

**`/ops-backlog`**: Create an issue in the backlog platform (GitHub, Azure DevOps, Jira) from a description.

**`/ops-evidence`**: Produce evidence a completed change works and publish it to the originating issue/PR. Decides if evidence is required, delegates to a project harness (`/make-evidence-scaffold`) when present else screenshots, writes `evidence/evidence.json` (passed/skipped/failed/blocked), and upserts an idempotent verified comment. Best-effort; `/plan-goal` runs it automatically.

**`/plan-archive`**: Mark a completed change as archived in OpenSpec. Run this after the PR is merged.

---

### Maintaining the project?

**`/make-engineer`**: Add a custom specialist engineer to the team. Interactive persona-driven form: pick a persona, then confirm an inspected-and-recommended set of skills (architecture/patterns like FSD or design patterns, framework, testing, infra) before anything installs. Future `/plan-apply` runs will prefer it when its domain matches.

**`/make-architecture`**: Regenerate `ARCHITECTURE.md` from the current codebase. Safe to rerun any time the architecture evolves.

**`/make-design`**: Regenerate `DESIGN.md` from the design system (Tailwind, CSS vars, tokens, etc.).

**`/make-evidence-scaffold`**: Scaffold a project-specific visual-evidence harness (deterministic capture, assertions, `evidence.json` manifest, and a verified issue/PR publisher) adapted to your stack. Afterwards `/ops-evidence` and `/plan-goal` delegate to it automatically.

**`/make-guardrails`**: Generate a `ob-guardrails-project` skill from `ARCHITECTURE.md` and project config files. Extracts concrete rules (architecture boundaries, naming, code style, testing, git workflow) that all agents must follow. Updates every `*-engineer.md` to load the skill.

**`/repo-verify`**: Verify the current branch against applicable guardrails and project checks. Repairs relevant failures, checks dependency/lockfile consistency, and reports `VERIFIED` only when every applicable check passes. It runs automatically in `/plan-goal`.

**`/make-user-model <tier> <model>`**: Set the model for a tier (`plan`, `build`, or `fast`). Writes to `.opencode/opencode-onboard.json` (`models`). Use `user` prefix for a personal override: `/make-user-model user fast opencode/big-pickle`. Use a model id or `current` for the active session model. Restart opencode for the `ob-subagent-tiers` plugin to rebuild tier agents.

---

### Typical workflows

**Complex change:**
```
/plan-explore   ← optional: think it through first
/plan-propose   ← create the plan
/plan-apply     ← implement with the team
/ops-ship        ← ship
/plan-archive   ← close out
```

**Quick change:**
```
/plan-quick     ← create a focused task list
/plan-apply     ← implement
```

**Unattended / loop-engineering:**
```
/plan-goal <description>  ← full pipeline, no interaction
```
