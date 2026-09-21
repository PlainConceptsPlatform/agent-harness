---
name: pc-plan-story
description: Write a detailed, repo-aware user story from a feature idea or need, then wrap it in the repository's issue form and append a structured implementation plan. Loads the @user-story skill for Mike Cohn format + Gherkin acceptance criteria, analyzes the codebase for concrete context, and produces a development-ready story with a plan. Use when the user wants to write a user story, create a story from a feature idea, or turn a need into a structured story with acceptance criteria. Invoked by the /plan-story command.
license: MIT
---

Write a user story grounded in this repository. `@user-story` owns the format and the quality bar; `@humanizer` owns the prose. What this skill adds is the grounding: the personas, paths, models and components come out of the codebase, not out of a template.

## Input

A feature description, need, or rough idea, possibly with exploration findings and diagrams to align the scope with. If `$ARGUMENTS` is empty, ask what the user wants to capture.

The caller may pass exploration findings from a prior `/plan-explore` session. Treat them as the primary source for the codebase inventory; read files only to fill gaps the findings do not cover.

<!-- PC-OPTIMIZATION-MEMORY-START -->
<!-- PC-OPTIMIZATION-MEMORY-END -->

## Rules

- Never write, edit, or create a file, and never start the work or invoke `/plan-propose` or `/plan-quick`. The only artefacts are the story (with its issue form and plan), and one question.
- Never write `As a user`. The persona comes from the repo's own roles: auth middleware, route guards, user models. A story that could have been written without opening the repo is not worth reviewing.
- Never show the user a story that fails the `@user-story` checks. Fix it first.
- Every `Given`, `When` and `Then` names something real, and every `Then` is testable: a file, endpoint, model or field somebody can point at.
- Never read outside this repository root. The entire inventory and plan must come from files inside this repo.
- Adhere to `${{ env.REPO_RULES }}` and repository documentation (AGENTS.md, ARCHITECTURE.md, DESIGN.md, existing patterns) before finalizing the story.
- Reserve the very top of the body — above the form's first heading — for machine-readable lines that later workflow steps add (split markers, estimate lines). Never place story or plan content there; the workflow reads those lines regardless of the form's shape.

## Flow

1. Load `@user-story`.

2. **Coverage gate.** List every work unit from the input. For each, confirm it has exploration findings concrete enough to write an acceptance scenario: the files it touches, the models or endpoints it changes, the constraints it must respect. If any work unit is missing findings, go back and explore it now by reading the codebase. Do not draft the story until every work unit is covered. This skill's own requirement is coverage: several work units become one story that covers all of them, with at least one acceptance scenario per unit.

3. Read the codebase for what the feature touches: who the users are (auth, roles, user models, guards), what exists now (components, endpoints, models, types), where the change lands (paths, module boundaries), and what rules already govern it (validation, existing flows). Incorporate any exploration findings, including their out-of-scope decisions.

4. Draft the story against that inventory. Each work unit gets at least one acceptance scenario. Pull two or three edge cases from what the code does today: a violated constraint, an empty or half-migrated state, a permission boundary.

5. Apply repository documentation and established conventions. Read AGENTS.md, ARCHITECTURE.md, DESIGN.md and any existing patterns that govern the area being changed. Adjust the story to respect them.

6. Load `@humanizer` and run it over the prose. It cleans prose, not structure: paths, component names and Gherkin stay exact.

7. Add a Mermaid diagram only for a multi-step flow, a state transition, or a component interaction, and only the happy path. A single-resource CRUD story does not need one. If the input carried an exploration diagram, extend it rather than redrawing.

8. **Issue form: discover, select, fill.**

   *Discover:* List the YAML and Markdown forms under `.github/ISSUE_TEMPLATE/`, plus a legacy `.github/issue_template.md` or a root `template.yml`. `config.yml` there only declares contact links, which are not forms: ignore it.

   *Select:* When a form filters by labels and the issue carries one of those labels, that form wins. Otherwise use the repository's default form. When the repository has no form at all, keep the free-form story shape from step 4: there is nothing to wrap around.

   *Fill:* Draw every field's content from your exploration findings. Required fields always get real content; optional fields only when you genuinely have something for them. The story narrative lands in the field that asks for it — proposal, description, or what-happened, depending on the form. The Given/When/Then scenarios go into the form's acceptance-criteria field when it has one; otherwise they stay a section of their own. The Mermaid diagram goes where it reads best inside the filled form.

9. **Plan section.** Using the codebase investigation from step 3, produce a structured implementation plan that goes after the story inside the issue form body. Format it as follows:

   Start with a one-line scope summary, then a context paragraph describing what areas the plan touches, how many changes it breaks into, and whether the changes are independent.

   Then break the feature into numbered changes. Each change:

   - **Title** — what the change does.
   - **Problem** — what is wrong or what needs to change and why. Name the file, method, or endpoint.
   - **Fix** — bullet steps describing the implementation approach. Each step names a concrete file, method, or field.
   - **Affected files** — a bullet list of paths with a short note on what changes in each.

   After all changes, add a summary table:

   ```markdown
   | Change | Files | Layer |
   |---|---|---|
   | 1. <title> | <file list> | <Backend | Frontend | Fullstack | Infra | Tests> |
   ```

   Then list exclusions — what is explicitly out of scope and why.

   Do not write any files. The plan is part of the story output, read-only. It tells the implementer what to touch and why, so they can start without re-investigating.

10. Show the story with the issue form wrapping, the plan, and the artefacts it is grounded in, then ask what is next. If the plan has an open clarification — a wording choice, a missing constraint, an unknown API — ask it before the contracts question.

## Contracts

```json
{
  "questions": [
    {
      "header": "What next",
      "question": "What next?",
      "options": [
        { "label": "/plan-propose", "description": "Turn this user story into a full OpenSpec proposal with design, specs, and tasks." },
        { "label": "/plan-quick", "description": "Create a lightweight task checklist from this story." },
        { "label": "Refine the story", "description": "Iterate on the story with feedback." }
      ]
    }
  ]
}
```
