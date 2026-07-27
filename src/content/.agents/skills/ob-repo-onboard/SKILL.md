---
name: ob-repo-onboard
description: Walk the user through the project and its agentic infrastructure. Explains what exists, how agents work, and how to use the system. Invoked by the /repo-onboard command.
license: MIT
---

This command is a guided tour. Read and explain only.

## Step 1: Project overview

Read `AGENTS.md`, `ARCHITECTURE.md`, and `DESIGN.md`. Summarize:

- What this project is (name, purpose, domain)
- Tech stack (languages, frameworks, build system)
- Project structure (key directories and what they contain)

Keep it to 3 to 5 bullet points. Focus on what a new contributor needs to know.

## Step 2: Agent infrastructure

Inspect `.opencode/agents/` and list every agent file. For each agent, read its frontmatter and summarize:

- Agent name and role (primary, subagent, or specialist)
- Model tier it uses (plan, build, or fast)
- Key abilities: what it can do

Present as a table:

| Agent | Role | Tier | Purpose |
|---|---|---|---|
| ... | ... | ... | ... |

Then explain the agent selection model:
- Primary agents appear in Tab and handle direct user interaction
- Subagent engineers are spawned by the lead for parallel implementation waves
- Specialist engineers are preferred when their domain matches the task; `fullstack-engineer` is the user's planning agent (`mode: primary`), not a spawned worker. If no specialist matches, create one with `/make-engineer`.

## Step 3: Command reference

Read every `.md` file in `.opencode/commands/`. List each command with its name and description:

| Command | What it does |
|---|---|
| ... | ... |

Group them by workflow phase if possible:
- Planning: plan-explore, plan-story, plan-propose, plan-quick, plan-goal
- Implementation: plan-apply, plan-archive
- Maintenance: make-architecture, make-design, make-engineer, make-guardrails, make-evidence-scaffold
- Shipping: ops-ship, ops-review, ops-backlog, ops-evidence
- Quality: repo-audit, repo-verify
- Setup: init, make-user-model, repo-help

## Step 4: Skills

Inspect `.agents/skills/` (if present). List installed skills with a one-line description each. Note which are platform-specific (userstory, pullrequest) vs general-purpose, and identify `ob-repo-audit` as read-only and `ob-repo-verify` as the current-branch verification gate.

## Step 5: OpenSpec workflow

Explain the OpenSpec change lifecycle:

1. Explore (`/plan-explore`): investigate and discuss, no files created
2. Propose (`/plan-propose`): structured plan, saved to `openspec/changes/`
3. Apply (`/plan-apply`): implement tasks via parallel subagent waves
4. Archive (`/plan-archive`): finalize and clean up

Explain `openspec/config.yaml`: what it contains and why it matters.

## Step 6: Configuration

Explain `opencode-onboard.json`:
- What each field controls (platform, models, agents, tools, source)
- How to change the model for a tier (`/make-user-model`)
- What `agents.maxConcurrent` does

## Step 7: Quick tips

End with 3 to 5 practical tips:

- How to start working: "Run `/plan-goal` with a description of what you want to build"
- How to add a specialist: "Run `/make-engineer`"
- How to regenerate docs: "Run `/make-architecture` or `/make-design`"
- How to audit the whole repository: "Run `/repo-audit`"
- How to verify an active branch: "Run `/repo-verify`"
- How to set up visual evidence: "Run `/make-evidence-scaffold` (UI projects) so `/plan-goal` can prove changes with screenshots"
- How to see all commands: "Run `/repo-help`"
- How to refresh config after changes: "Re-run `npx opencode-onboard` in the terminal"
