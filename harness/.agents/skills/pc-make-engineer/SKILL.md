---
name: pc-make-engineer
description: Create a custom engineer agent via persona-driven interactive design. Invoked by the /make-engineer command.
license: MIT
---

Create one file, `.opencode/agents/{persona}-engineer.md`, from the [template](template.md). The research behind it is for choosing the right skills, not for filling the file: expertise notes, architecture, conventions, file maps and workflow steps belong in skills.

## Rules

- Never write the agent file before the user has confirmed the skill set and it is installed. An engineer whose abilities do not exist cannot work.
- Never write `model:` or `color:`. `pc-subagent-tiers` injects both at startup, so a hand-picked colour is overwritten.
- Never create `*.build.md`, `*.fast.md`, `*.plan.md`, `build.md` or `plan.md`. The plugin regenerates all of them every startup and anything written there is lost.
- `mode: subagent`. Engineers are reached through `task()`, and a primary would clutter the two-entry list a human picks from.
- The only `##` heading is `## Abilities`, and the identity paragraph is two or three sentences carrying no project knowledge.
- Every `@skill` under `## Abilities` exists in `.agents/skills/` and in `skills-lock.json`. A name that is not installed is skipped rather than blocking the worker, so a typo costs the agent that ability in silence.
- Project-local installs only: `npx skills add -y ...`, never `-g`.
- At most five form questions, and only where more than one option was detected. A signal with one option is used without asking.

## Contracts

Personas: `frontend`, `layout`, `backend`, `data`, `devops`, `security`, `mobile`, `api`, `qa`. A persona passed as an argument (`/make-engineer frontend`) or typed by the user is taken as given.

Signals to detect: language, framework, data layer, testing, styling, architecture, i18n, CI/CD, cloud and IaC, monitoring, linting, dependency injection.

Discovery needs `find-skills`, and has no fallback without it:

```bash
npx skills add -y vercel-labs/skills@find-skills
```

When `.opencode/agents/{persona}-engineer.md` already exists, ask before touching it:

```json
{
  "questions": [
    {
      "header": "Overwrite engineer",
      "question": "An engineer named \"{persona}-engineer\" already exists. Overwrite or cancel?",
      "options": [
        { "label": "Overwrite", "description": "Rewrite the file from the template." },
        { "label": "Cancel", "description": "Stop. Do not modify the existing file." }
      ]
    }
  ]
}
```

`fullstack-engineer.md` is the body `pc-subagent-tiers` copies into `build.md` and `plan.md`, so every skill listed there reaches both primaries. Merge into it additively: add only skills it does not already list, put them in the category lines that already exist where they fit, and leave its frontmatter, identity paragraph and existing ability lines alone.

## Flow

1. **Persona.** Ask with the `question` tool unless it arrived as an argument. The answer decides what to detect, what to ask, and which skills to look for.
2. **Signals.** Read `.opencode/source-roots.json` (if it is missing or empty, ask which directories to scan), then `ARCHITECTURE.md`, `DESIGN.md`, and the manifests (`package.json`, `tsconfig.json`, `*.csproj`, `pyproject.toml`, `go.mod`, `Cargo.toml`). Detect what the persona needs and report the inventory.
3. **Form.** Present the detected options with the `question` tool, pre-selected and marked `(Recommended)`. For `frontend`, `backend`, `layout` and `api`, one question is architecture and patterns, whose options come from the [signal mapping](signal-mapping.md) tables.
4. **Skills.** A signal already covered by a skill in `.agents/skills/` or `skills-lock.json` needs no search. Map each remaining signal to a query through the [signal mapping](signal-mapping.md), present the candidates as one multi-select `question` grouped by category (name, one line, `owner/repo`, install count), install what the user confirms, and verify each one landed in both `.agents/skills/` and the lockfile.
5. **Write** the file from the [template](template.md).
6. **Merge** the new skills into `fullstack-engineer.md`.
7. **Report** the file created, the skills installed, the signals with no quality skill, whatever failed, and that opencode has to restart before `pc-subagent-tiers` picks the engineer up.
