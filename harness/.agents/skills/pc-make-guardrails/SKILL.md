---
name: pc-make-guardrails
description: Generate or update the pc-guardrails-project skill from ARCHITECTURE.md and relevant project files, then wire it into every engineer agent. Invoked by the /make-guardrails command and the repo-initialize flow.
license: MIT
---

# Make Guardrails

Analyze `ARCHITECTURE.md` and other project files to generate or update a `pc-guardrails-project` skill: a set of rules and constraints extracted from the project's own documentation that agents must follow.

## Steps

1. **Check current state**

   Read `.agents/skills/pc-guardrails-project/SKILL.md`. Determine which mode to use:
   - Does not exist: Generate mode. Create from scratch.
   - Exists and has a `<!-- Last updated:` footer: Update mode. Incrementally update.
   - Exists but no timestamp: proceed in Generate mode (full regeneration).

2a. **Generate mode: read source documents**

   Read ALL of the following that exist:
   - `ARCHITECTURE.md` (primary source)
   - `DESIGN.md` (design system, component conventions)
   - `AGENTS.md` (existing agent instructions, optimizations)
   - `README.md` (setup, conventions)
   - `CONTRIBUTING.md` (if present)
   - `.opencode/harness.json` (platform, models, concurrency)
   - `openspec/config.yaml` (if present: domain context and rules)
   - Root config files: `package.json`, `tsconfig.json`, `biome.json`, `.eslintrc*`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `pom.xml`: whatever exists
   - CI/CD workflows: `.github/workflows/*`, `azure-pipelines.yml`: whatever exists

   Use file tools to discover constraints: `read` the documents above, `grep` for lint/formatter config rules.

2b. **Update mode: incremental analysis**

   Extract the `<!-- Last updated: <ISO date> -->` timestamp from the existing skill file. Then:
   - Read `ARCHITECTURE.md` and check its `<!-- Last updated:` timestamp. If ARCHITECTURE.md hasn't changed since the guardrails were last generated, report "Guardrails up to date" and stop.
   - Run `git log --oneline --since="<date>" -- <config files, lint configs, CI workflows>` to find what convention/config files changed.
   - If nothing changed: report "Guardrails up to date" and stop.
   - Update only the affected rule categories. Preserve manually-added rules in unchanged categories.
   - If changes are pervasive (new architecture, new framework, new platform), fall back to Generate mode.

3. **Extract guardrails**

   From the documents and code graph analysis, extract concrete, actionable rules. Follow the [category reference](category-reference.md) for the full list of categories, rule quality standards, and the skill file template.

4. **Write the skill**

   Write (or update) `.agents/skills/pc-guardrails-project/SKILL.md` using the template from the [category reference](category-reference.md). Only include sections that have real rules. Omit empty sections.

5. **Update agents**

   For every `*-engineer.md` in `.opencode/agents/`, add `@pc-guardrails-project` to the Guardrails ability line (skip if already present). Keep the line's existing entries exactly as they are: only insert `@pc-guardrails-project` after `@pc-guardrails-generic`, using this pattern:
   ```markdown
   ## Abilities
   - Guardrails: @pc-guardrails-generic, @pc-guardrails-project[, ...existing entries unchanged]
   ```

   Exclude tier variant files (`*-engineer.build.md`, `*-engineer.fast.md`, `*-engineer.plan.md`): they are generated copies; only update the base templates.

6. **Store summary in configured persistent context**

   `write_note` MCP tool with title `guardrails-summary` containing:
   - The ISO timestamp of this run
   - Number of rules per category

7. **Report**

   Tell the user:
   - Whether the skill was generated or updated (and which categories changed)
   - Number of rules extracted per category
   - Number of agent files updated
   - Tip: "Rerun `/make-guardrails` any time the architecture or conventions change significantly."
