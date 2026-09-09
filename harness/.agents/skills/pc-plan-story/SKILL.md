---
name: pc-plan-story
description: Write a detailed, repo-aware user story from a feature idea or need. Loads the @user-story skill for Mike Cohn format + Gherkin acceptance criteria, analyzes the codebase for concrete context, and produces a development-ready story. Use when the user wants to write a user story, create a story from a feature idea, or turn a need into a structured story with acceptance criteria. Invoked by the /plan-story command.
license: MIT
---

Write a user story grounded in this repository. `@user-story` owns the format and the quality bar; `@humanizer` owns the prose. What this skill adds is the grounding: the personas, paths, models and components come out of the codebase, not out of a template.

## Input

A feature description, need, or rough idea, possibly with exploration findings and diagrams to align the scope with. If `$ARGUMENTS` is empty, ask what the user wants to capture.

<!-- PC-OPTIMIZATION-MEMORY-START -->
<!-- PC-OPTIMIZATION-MEMORY-END -->

## Rules

- Never write, edit, or create a file, and never start the work or invoke `/plan-propose` or `/plan-quick`. The only artefacts are the story and one question.
- Never write `As a user`. The persona comes from the repo's own roles: auth middleware, route guards, user models. A story that could have been written without opening the repo is not worth reviewing.
- Never show the user a story that fails the `@user-story` checks. Fix it first.
- Every `Given`, `When` and `Then` names something real, and every `Then` is testable: a file, endpoint, model or field somebody can point at.

## Flow

1. Load `@user-story`.
2. Read the codebase for what the feature touches: who the users are (auth, roles, user models, guards), what exists now (components, endpoints, models, types), where the change lands (paths, module boundaries), and what rules already govern it (validation, existing flows). Incorporate any exploration findings, including their out-of-scope decisions.
3. Draft the story against that inventory, with two or three edge cases taken from what the code does today: a violated constraint, an empty or half-migrated state, a permission boundary.
4. Load `@humanizer` and run it over the prose. It cleans prose, not structure: paths, component names and Gherkin stay exact.
5. Add a Mermaid diagram only for a multi-step flow, a state transition, or a component interaction, and only the happy path. A single-resource CRUD story does not need one. If the input carried an exploration diagram, extend it rather than redrawing.
6. Show the story with the artefacts it is grounded in, then ask what is next.

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
