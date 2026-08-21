# Agent file template

The agent file is exactly this structure: frontmatter plus one identity paragraph plus the `## Abilities` section. No other sections. No other content.

```markdown
---
description: <one sentence naming the persona + top 3-5 detected technologies>
mode: subagent
permission:
  edit: allow
  bash: allow
  read: allow
  glob: allow
  grep: allow
---

<One paragraph: "You are a {persona} engineer specializing in {top technologies}. You own all work in {scope/files}." Keep it to 2-3 sentences max.>

## Abilities
- Guardrails: @pc-guardrails-generic, @pc-guardrails-project
- Development: <@installed-skill-1>, <@installed-skill-2>, ...
- Testing: <@installed-skill-for-testing>, ...
- Infrastructure: <@installed-skill-for-devops>, ...
```

That is the entire file: frontmatter, one identity paragraph, and the `## Abilities` section. The always-installed `pc-system-reminders` plugin loads the listed skills for every session. Replace every `<...>` placeholder with real values from your research. Remove any ability category line that has no skills assigned (besides Guardrails which is always present).

## Description quality bar

The `description:` field is the matching key for `/plan-apply`. The lead compares task domain text against agent descriptions to pick the right specialist. A weak description means the wrong engineer gets spawned.

Bad: `"A frontend engineer for React"`
Good: `"Frontend engineer for Ink 7 + React 19 TUI, FSD architecture, Inversify DI, design tokens, and i18n"`

Rules:
- Name the persona explicitly
- List the top 3-5 detected technologies from Step 2
- One sentence, no padding

## Identity paragraph

The identity paragraph sits between frontmatter and `## Abilities`. It tells the engineer who it is and what it owns in 2-3 sentences max. Not a spec, not a knowledge dump, a quick scoping statement.

Bad: 5 paragraphs of architecture details, FSD rules, design tokens, file maps, testing patterns.
Good: `"You are a frontend engineer specializing in terminal UI development with Ink 7 + React 19. You own all work in the FSD layers: src/app/, src/widgets/, src/features/, src/entities/, and src/shared/."`

Rules:
- State the persona and specialization in one sentence
- State what files or layers the engineer owns in one sentence
- Never exceed 3 sentences

## Category rules

- Development = language/framework/UI/DI skills. Testing = test/lint/typecheck skills. Infrastructure = DevOps/CI/CD/cloud skills.
- Only include ability categories that have at least one real skill (besides Guardrails which is always present).
- Name follows `{persona}-engineer` pattern (e.g. `frontend-engineer`, `backend-engineer`).
- Read existing agents' `color:` frontmatter first: pick a color not already used.
- `warning` is reserved for the lead (fullstack) engineer, the planning agent. Never assign it to a spawned specialist.

## Structural validation checklist

After writing the agent file, verify:

1. Frontmatter exists: starts with `---`, has `description`, `mode: subagent`, `permission` block. No `color`: the `pc-subagent-tiers` plugin derives one from the agent name at startup.
2. No `model:` field in the frontmatter. The `pc-subagent-tiers` plugin injects it.
3. `## Abilities` is the only `##` heading. No other `##` sections exist in the file.
4. One identity paragraph before `## Abilities`: 2-3 sentences max, not multiple paragraphs.
5. Abilities are categorized: each line starts with `- Guardrails:`, `- Development:`, `- Testing:`, or `- Infrastructure:`. No bare `@skill-name` lines.
6. One file only: no `.build.md`, `.fast.md`, or `.plan.md` variant was created.

If any check fails, rewrite the file to match the template exactly.

## Skill reference validation

1. Parse every `@skill-name` from the `## Abilities` section (excluding `@pc-guardrails-generic` and `@pc-guardrails-project` which are installed at init).
2. For each: check `.agents/skills/<skill-name>/SKILL.md` exists.
3. For each: check `skills-lock.json` contains the skill.
4. If `.agents/skills/<skill-name>/SKILL.md` exists but `skills-lock.json` is missing the entry: manually patch `skills-lock.json` using the Edit tool (same procedure as in the signal mapping reference). Re-read `skills-lock.json` to confirm it is valid JSON.
5. If `.agents/skills/<skill-name>/SKILL.md` is missing: try to install it: `npx skills add -y <owner/repo@skill-name>` (search `skills-lock.json` or `npx skills find` for the owner/repo). If install fails or the skill can't be found on skills.sh, remove the reference from the file, warn the user, and note it in the summary.
6. Re-read the file to confirm all remaining `@skill-name` references are valid.
