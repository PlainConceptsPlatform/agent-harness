# AGENTS.md

<!-- PC-NOT-INITIALIZED -->

# Agent operating guide

This guide defines the common operating contract for AI agents in this repository.
It is agent-agnostic and works with OpenCode, Claude Code, Codex, Gemini, and other agents.

## Purpose and scope

Use this file for repository-wide workflow rules. Keep product architecture, security constraints, and design rules in their source documents rather than duplicating them here.

## Session context

Before a non-trivial change, read these documents in order:

1. `AGENTS.md` for workflow and repository rules.
2. `ARCHITECTURE.md` for boundaries, dependencies, and component interactions.
3. `DESIGN.md` for UI and design-system work.
4. The active OpenSpec change or the relevant specification for the area being changed.

Read each document once per session unless it changes or the task moves into a different area.

Command aliases: OpenSpec skills may reference `/opsx-propose`, `/opsx-apply`, `/opsx-archive`, or `/opsx-explore`. Always substitute them with the `pc-plan-propose`, `pc-plan-apply`, `pc-plan-archive`, and `pc-plan-explore` skills respectively. User-facing command names are `/plan-propose`, `/plan-apply`, `/plan-archive`, and `/plan-explore`. Never mention the `opsx-` names to the user.

## Workflow ownership

<!-- PC-PLATFORM-WORKFLOW-START -->
<!-- PC-PLATFORM-WORKFLOW-END -->

## Planning and execution

- Plan before delegating work. Use OpenSpec when the change needs explicit scope, decisions, or sequenced tasks.
- Keep changes focused. Do not combine unrelated refactors with requested work.
- Do not guess when requirements, architecture, or security constraints are unclear. Ask before proceeding.
- Prefer the project's established patterns and source documents over introducing new conventions.

## Engineer selection

Inspect `.opencode/agents/*.md` before spawning. Prefer the most specialized custom engineer. `fullstack-engineer` is `mode: primary`, the planning agent, and is not a spawned worker. If no specialist matches, tell the user to create one with `/make-engineer`. Spawn only engineers present in that directory.

The `pc-plan-apply` skill is authoritative for subagent waves, dependency ordering, retries, and concurrency. Read `agents.maxConcurrent` from `.opencode/harness.json` before spawning workers.

## Tool and repository safety

- Never expose or commit secrets, credentials, tokens, or production data.
- Read before editing. Respect repository ownership, generated files, and existing local changes.
- Run only commands appropriate to the task. Do not bypass checks, weaken tests, or silence lint rules to get a green result.
- Commit, push, create pull requests, alter dependencies, or change deployment configuration only with the user's explicit approval and the repository's stated process.

## Verification and completion

- Run the applicable tests, lint, typecheck, and build before reporting completion.
- A bug fix needs a test that would have caught the defect when practical.
- Update specifications, architecture, or design documentation when the change makes their current statements inaccurate.
- Report changed files, checks run, and any remaining risk or follow-up work.

## Communication

- Keep updates concise and factual.
- State blockers early and explain the decision needed.
- Use the repository's language and writing conventions for source, documentation, issues, commits, and pull requests.
- Comments explain non-obvious reasons, constraints, or invariants. Do not add comments that restate code.

## Skills

Skills live in `.agents/skills/`. Always installed: `@pc-guardrails-generic`, `@pc-guardrails-project`, and `@browser-automation`. The always-installed `pc-system-reminders` plugin loads each agent's `## Abilities` before work, guardrails first. Skills can require mandatory transitive loads. Keep `## Abilities` complete and do not treat entries as passive references.

<!-- PC-PLATFORM-SKILLS-GUIDE-START -->
<!-- PC-PLATFORM-SKILLS-GUIDE-END -->
