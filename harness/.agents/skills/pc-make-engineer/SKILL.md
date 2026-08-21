---
name: pc-make-engineer
description: Create a custom engineer agent via persona-driven interactive design. Invoked by the /make-engineer command.
license: MIT
---

Create one file only: `.opencode/agents/{persona}-engineer.md`. The `pc-subagent-tiers` plugin creates tier variants (`.build.md`, `.fast.md`, `.plan.md`) at startup, so you never write those. It also generates `build.md` and `plan.md`, the only two primary agents: never create or edit those either.

Fidelity to the [template](template.md) is the whole job. The file contains frontmatter plus one identity paragraph plus the `## Abilities` section. No other `##` headings. No expertise notes, architecture details, conventions, file maps, or workflow steps. Those belong in skills. Always set `mode: subagent`. Engineers are reached through `task()`, never picked by a human, so a primary engineer would only clutter the agent picker. Never write `model:` and never write `color:`. The `pc-subagent-tiers` plugin derives a colour from the agent name at startup, which is why the same persona looks the same in every project; `primary` and `warning` belong to the build and plan agents. Only reference skills installed in the project's `.agents/skills/` directory.

Skills first: you must complete Step 4 (present the form, discover skills for every detected signal and architecture, let the user confirm the set, then install 5-10 skills) before writing any file.

## Step 1: Ask persona (always, closed choice)

Ask the user this question using the `question` tool:

> **"What type of engineer are you creating?"**
>
> - Frontend: UI components, pages, mobile, styling, browser
> - Layout Designer: Design systems, CSS architecture, Storybook, a11y
> - Backend: APIs, databases, auth, services
> - Data: Data pipelines, ETL, analytics, ML models, data quality
> - DevOps: CI/CD, infra, Docker, deploy
> - Security: Auth, secrets, vulnerability scanning, hardening
> - Mobile: React Native, Flutter, native iOS/Android
> - API / Integration: REST/GraphQL APIs, webhooks, third-party integrations
> - QA: Test automation, E2E, regression, performance testing

The chosen persona determines everything: what to detect, what questions to ask, what skills to suggest.

If the user passes the persona as an argument (e.g. `/make-engineer frontend`) or selects "Type your own answer", accept any single-word persona name and skip to Step 2.

## Step 2: Detect signals from source roots

Check `source-roots.json` first. Read `.opencode/source-roots.json`. If it doesn't exist or has empty roots, ask the user which directories to scan using the `question` tool with the project's top-level directories as options.

Also read `ARCHITECTURE.md` and `DESIGN.md` for context on the tech stack.

Scan for persona-relevant signals only. Look in manifest files (`package.json`, `tsconfig.json`, `*.csproj`, `pyproject.toml`, `requirements.txt`, `go.mod`, `Cargo.toml`, etc.) and project structure:

- Language: primary language(s) and version(s)
- Framework: web, backend, or mobile framework
- Data layer: ORM, database client, cache client
- Testing: test framework, test config files, test directories
- Styling: CSS framework, CSS-in-JS, design tokens
- Architecture: FSD, monolith, microservices, feature dirs
- i18n: internationalization libs
- CI/CD: workflow definition files
- Cloud / IaC: cloud provider config, infrastructure-as-code files
- Monitoring: observability/monitoring config or deps
- Linting: linter, formatter, and their config files
- Dependency Injection: DI/IoC containers, hook frameworks

Report what was detected as a signal inventory. This list drives Step 4 deterministically:

```
Signal inventory:
  <signal-type>: <signal-value> (<source>)
  <signal-type>: <signal-value> (<source>)
  ...
```

## Step 3: Persona-specific form (recommend and confirm)

Present a short form using the `question` tool. Each question is a closed choice or yes-no. Every option that matches a detected signal from Step 2 must be marked (Recommended) and pre-selected. The user just confirms or overrides.

Ask 2-5 questions total:

1. Architecture / patterns (always ask for `frontend`, `backend`, `layout`, `api` personas; optional otherwise). Use `multiple: true`. Pre-select the architecture detected in Step 2 and mark it (Recommended); offer common alternatives so the user can opt in even when the codebase does not signal one yet. Options map to the known sources in the [signal mapping](signal-mapping.md) reference:
   - Feature-Sliced Design (FSD)
   - Design patterns: singleton, observer, factory, hooks, HOC, compound, render-props, provider
   - Rendering patterns: SSR, RSC, streaming, static, islands, progressive hydration
   - Performance patterns: bundle splitting, tree-shaking, dynamic import, route-based
   - Microservices
   - Monolith / layered
2. Up to 4 more questions, only where Step 2 detected multiple options or where the user's choice genuinely matters (e.g. which test runner, which styling approach, which cloud). Skip anything with a single detected option and just use it silently.

Rules:
- Options matching a detected signal are (Recommended) and pre-selected.
- Never ask about things where only one option was detected.
- Keep the whole form to 5 questions max.
- The user's selections here (plus Step 2 signals) become the recommended skill set that Step 4 resolves, confirms, and installs.

## Step 4: Skill discovery, confirmation, and install

Complete this step fully before writing anything in Step 5. The agent file is worthless without real skills. The flow is: discover candidates, confirm with the user, install the confirmed set, verify.

### 4a. Pre-check already-installed skills

Before searching, build a map of what's already available:

1. List every directory in `.agents/skills/`
2. Read `skills-lock.json` for npx-installed skills
3. For each detected signal from Step 2, check if an already-installed skill covers it
4. Mark covered signals as already-satisfied

Report:

```
Already installed:
  <skill-name> covers <signal>
  ...
Signals still needing skills:
  - <signal-type>: <signal-value>
  ...
```

### 4b. Ensure `find-skills` is available

Check if `.agents/skills/find-skills/SKILL.md` exists. If not, install it:

```bash
npx skills add -y vercel-labs/skills@find-skills
```

If it can't be installed, stop and tell the user: "find-skills is required for skill discovery. Install it manually with `npx skills add -y vercel-labs/skills@find-skills` and re-run."

### 4c. Search and resolve

For each uncovered signal, run `npx skills find` with the query and resolve architecture/patterns via the known direct sources. Follow the [signal mapping](signal-mapping.md) reference for the full table of queries, known direct sources, quality filter, recommended set assembly, and post-install verification.

### 4d. Confirm the skill set (the form)

Present the recommended set to the user as a multi-select form using the `question` tool with `multiple: true`, and pre-select every recommended skill. This is the confirmation gate.

- Group the options by category: Architecture, Development, Testing, Infrastructure.
- For each skill show: name, one-line description, source (`owner/repo`), and install count (or "curated source" for known direct source entries).
- Every recommended skill is checked by default; the user unchecks anything unwanted.
- Include a short note that they can request additional skills by name.
- Nothing installs until the user submits this form.

The submitted selection is the confirmed set. Install only the confirmed set in the next step.

### 4e. Install the confirmed set

Install each confirmed skill (project-local). Always pass `-y` to skip the skills CLI's own prompt. Use the syntax that matches the source:

```bash
# skills.sh index entries (from npx skills find):
npx skills add -y <owner/repo@skill-name>

# known direct sources (Step 4c):
npx skills add -y feature-sliced/skills
npx skills add -y PatternsDev/skills --skill <skill-name>
```

Project-local only. Do not use the `-g` flag.

Then run the [post-install verification](signal-mapping.md) procedure for each installed skill.

## Step 5: Fill the template

Before creating the file, check if `.opencode/agents/{persona}-engineer.md` already exists. If it does, call the `question` tool:

```json
{
  "questions": [
    {
      "header": "Overwrite engineer",
      "question": "An engineer named \"{persona}-engineer\" already exists. Overwrite or cancel?",
      "options": [
        { "label": "Overwrite", "description": "Proceed, preserving the existing color frontmatter value unless a new one is chosen." },
        { "label": "Cancel", "description": "Stop. Do not modify the existing file." }
      ]
    }
  ]
}
```

- If `Overwrite`: proceed, but preserve the existing `color:` frontmatter value unless the user chose a new one.
- If `Cancel`: stop.

Fill the [template](template.md). All the research from Steps 2-4 (signal detection, project analysis, tech stack knowledge) was for selecting the right skills. The agent file itself is just the template. Do not write project knowledge, architecture notes, coding conventions, file maps, testing patterns, or workflow instructions into the file. Those belong in skills and guardrails.

Follow the [template](template.md) reference for the full structure, description quality bar, identity paragraph rules, category rules, and structural validation checklist.

## Step 6: Validate the file

After writing the agent file, run both checks from the [template](template.md) reference:

1. Structural validation: verify frontmatter, no `model:` field, `## Abilities` is the only `##` heading, one identity paragraph, abilities categorized, one file only.
2. Skill reference validation: verify every `@skill-name` in `## Abilities` exists in `.agents/skills/` and in `skills-lock.json`.

If either check fails, fix the file and re-validate.

## Step 7: Update fullstack-engineer.md abilities

`fullstack-engineer.md` is `mode: subagent`, but it is also the body that `pc-subagent-tiers` copies into `build.md` and `plan.md` on every startup. So every skill listed here reaches both primary agents, which is why it accumulates all of them: it plans and delegates rather than doing parallel implementation itself.

After creating the persona engineer and validating its references, additively merge new skills into fullstack:

1. Read `.agents/skills/` directory to list all installed skills.
2. Read `skills-lock.json` for npx-installed skills.
3. Read the current `fullstack-engineer.md`.
4. Parse its existing `## Abilities` section to find which skills are already listed.
5. Append-only: add only skills that are not already in the file (dedup by skill name).
6. Preserve the frontmatter (mode, color, permissions, model if stamped), the identity paragraph, and all existing ability lines.
7. Remove any old startup directive line. The `pc-system-reminders` plugin loads abilities for every session.
8. Write the file back.

Merge new skills into existing categories. If a new skill belongs to "Development" and that line already exists, append to it. If a new category is needed, add it. Do not overwrite the Abilities section.

## Step 8: Update AGENTS.md

Add the new agent to the agents table in AGENTS.md (if a table exists) or note it:
```
| `{persona}-engineer` | .opencode/agents/{persona}-engineer.md | <short role description> |
```

## Step 9: Show summary

Report:
- Engineer file created at `.opencode/agents/{persona}-engineer.md`
- Skills installed from skills.sh (list each with source and install count)
- Signals with no quality skill found on skills.sh (list each)
- Skills that failed validation or install (list each with reason)
- `fullstack-engineer.md` updated (additive, list new skills added)
- How to use: "This agent will be spawned by the lead during `/plan-apply` for tasks matching its specialty."
- "Restart opencode for the `pc-subagent-tiers` plugin to pick up the new engineer and rebuild `build.md` and `plan.md` from the updated fullstack abilities."
