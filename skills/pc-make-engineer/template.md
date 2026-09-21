# Agent file template

The whole file, with nothing else in it:

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

Replace every `<...>` placeholder with real values, and drop any category line with no skills in it (Guardrails always stays). Development is language, framework, UI and DI skills; Testing is test, lint and typecheck skills; Infrastructure is DevOps, CI/CD and cloud skills.

## Description quality bar

`description:` is the matching key for `/plan-apply`: the lead compares a task's domain text against it to pick a specialist, so a vague one gets the wrong engineer spawned.

Bad: `"A frontend engineer for React"`

Good: `"Frontend engineer for Ink 7 + React 19 TUI, FSD architecture, Inversify DI, design tokens, and i18n"`

Name the persona, list the three to five technologies actually detected, one sentence, no padding.

## Identity paragraph

Two or three sentences: who the engineer is, and what files or layers it owns. A knowledge dump here is knowledge the lead cannot reuse and the engineer did not ask for.

Good: `"You are a frontend engineer specializing in terminal UI development with Ink 7 + React 19. You own all work in the FSD layers: src/app/, src/widgets/, src/features/, src/entities/, and src/shared/."`
