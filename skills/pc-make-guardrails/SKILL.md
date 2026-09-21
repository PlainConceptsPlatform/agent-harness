---
name: pc-make-guardrails
description: Generate or update the pc-guardrails-project skill from ARCHITECTURE.md and relevant project files, then wire it into every engineer agent. Invoked by the /make-guardrails command and the repo-initialize flow.
license: MIT
---

# Make Guardrails

Turn this project's own documentation into `.agents/skills/pc-guardrails-project/SKILL.md`: the rules and constraints its agents work under, per the [category reference](category-reference.md).

## Rules

- Never regenerate over a file that carries a `<!-- Last updated:` footer. `pc-guardrails-project` is the one skill a team is expected to hand-edit, and a full rewrite silently drops that work. Read the file first and pick the mode.
- Never invent a rule the project does not state somewhere. A guardrail that came from nowhere is one nobody agreed to, and it will be followed anyway.
- Never write an empty category. Omit it.
- Never touch a tier variant (`*-engineer.build.md`, `*-engineer.fast.md`, `*-engineer.plan.md`): they are regenerated from the base templates every startup.

## Sources

`ARCHITECTURE.md` is the primary one. Then whatever else exists: `DESIGN.md`, `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `.opencode/harness.json`, `openspec/config.yaml`, the root manifests (`package.json`, `tsconfig.json`, `biome.json`, `.eslintrc*`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `pom.xml`), and the CI definitions (`.github/workflows/*`, `azure-pipelines.yml`). Lint and formatter config is where the conventions are actually enforced, so it outranks any document that describes them.

## Modes

| The existing skill file | Mode |
|---|---|
| Missing | Generate |
| Has a `<!-- Last updated:` footer | Update |
| Exists with no footer | Generate |

**Update.** If `ARCHITECTURE.md` has not changed since the footer date, say "Guardrails up to date" and stop. Otherwise `git log --oneline --since="<footer date>" -- <config, lint config, CI workflows>`, update only the affected categories, and leave the rest, including hand-written rules, as they stand. A new architecture, framework or platform is a Generate.

## Wiring

Every `*-engineer.md` in `.opencode/agents/` gets `@pc-guardrails-project` on its Guardrails line, right after `@pc-guardrails-generic`, with its existing entries untouched:

```markdown
## Abilities
- Guardrails: @pc-guardrails-generic, @pc-guardrails-project[, ...existing entries unchanged]
```

## Report

Whether the skill was generated or updated and which categories changed, the rule count per category, how many agent files were wired, and that `/make-guardrails` can be re-run whenever the conventions move.
