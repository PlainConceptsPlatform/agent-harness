---
name: ob-make-merge-risk-assess
description: Generate or update the ob-merge-risk-assess skill from project guardrails and architecture. Produces a PR-level risk assessment that loop recipes can gate automerge on. Invoked by the /make-merge-risk-assess command and the repo-initialize flow.
license: MIT
---

# Make Merge Risk Assess

Analyze `ARCHITECTURE.md`, the project guardrails skill, and other project files to generate or update an `ob-merge-risk-assess` skill: a checklist of risk indicators that an AI agent evaluates before auto-merging a pull request. When any indicator matches, the agent blocks automerge and leaves the PR for human review with an explanation.

## Steps

1. **Check current state**

   Read `.agents/skills/ob-merge-risk-assess/SKILL.md`. Determine which mode to use:
   - Does not exist: Generate mode. Create from scratch.
   - Exists and has a `<!-- Last updated:` footer: Update mode. Incrementally update.
   - Exists but no timestamp: proceed in Generate mode (full regeneration).

2a. **Generate mode: read source documents**

   Read ALL of the following that exist:
   - `.agents/skills/ob-guardrails-project/SKILL.md` (primary source — project-specific constraints)
   - `.agents/skills/ob-guardrails-generic/SKILL.md` (generic safety rules)
   - `ARCHITECTURE.md` (architecture boundaries, critical paths)
   - `AGENTS.md` (non-negotiable constraints, verification rules)
   - `.opencode/opencode-onboard.json` (platform, concurrency)
   - CI/CD workflows: `.github/workflows/*`, `azure-pipelines.yml`: whatever exists
   - Loop recipes: `.loops/recipes/*-loop.yaml` (understand the automerge flow)

   Use file tools to discover risk-critical code paths: `grep` for calculation engines, audit appenders, auth middleware, schema migrations, permission checks, and other sensitive areas.

2b. **Update mode: incremental analysis**

   Extract the `<!-- Last updated: <ISO date> -->` timestamp from the existing skill file. Then:
   - Read `.agents/skills/ob-guardrails-project/SKILL.md` and check its `<!-- Last updated:` timestamp. If the guardrails haven't changed and ARCHITECTURE.md hasn't changed since the risk skill was last generated, report "Merge risk assessment up to date" and stop.
   - Run `git log --oneline --since="<date>" -- <relevant config and architecture files>` to find what changed.
   - If nothing changed: report "Merge risk assessment up to date" and stop.
   - Update only the affected risk categories. Preserve manually-added risk indicators in unchanged categories.
   - If changes are pervasive, fall back to Generate mode.

3. **Extract risk indicators**

   From the documents and code analysis, extract concrete, testable risk indicators. Follow the [category reference](category-reference.md) for the full list of categories, indicator quality standards, and the skill file template.

   Each risk indicator must identify a code path or change pattern that, when touched, makes a PR too dangerous to auto-merge. The indicator must be something an AI agent can detect by reading the PR diff.

4. **Write the skill**

   Write (or update) `.agents/skills/ob-merge-risk-assess/SKILL.md` using the template from the [category reference](category-reference.md). Only include sections that have real indicators. Omit empty sections.

5. **Update agents**

   For every `*-engineer.md` in `.opencode/agents/`, add `@ob-merge-risk-assess` to the Agent Workflow ability group (skip if already present). This ensures every engineer can evaluate risk before merge. Use this pattern:
   ```markdown
   ## Abilities
   - Guardrails: @ob-guardrails-generic, @ob-guardrails-project[, ...existing entries unchanged]
   ...
   - Development, Agent Workflow: @ob-merge-risk-assess[, ...existing entries unchanged]
   ```

   If no "Development, Agent Workflow" line exists, create it. Exclude tier variant files (`*-engineer.build.md`, `*-engineer.fast.md`, `*-engineer.plan.md`): they are generated copies; only update the base templates.

6. **Report**

   Tell the user:
   - Whether the skill was generated or updated (and which categories changed)
   - Number of risk indicators extracted per category
   - Number of agent files updated
   - Tip: "Rerun `/make-merge-risk-assess` any time the architecture or project guardrails change significantly."
