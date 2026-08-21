---
name: pc-plan-story
description: Write a detailed, repo-aware user story from a feature idea or need. Loads the @user-story skill for Mike Cohn format + Gherkin acceptance criteria, analyzes the codebase for concrete context, and produces a development-ready story. Use when the user wants to write a user story, create a story from a feature idea, or turn a need into a structured story with acceptance criteria. Invoked by the /plan-story command.
license: MIT
---

Write a user story grounded in the actual codebase. Load the `@user-story` skill and follow its format (Mike Cohn "As a / I want to / so that" + Gherkin "Given / When / Then"). The story must be specific: real personas, real file paths, real component names, real data models — not generic placeholders.

This skill is read-only. You may read files, search code, and use `todowrite` to create Todo pane items. The only output is the user story itself and a question to the user. No files, no OpenSpec changes, no branches.

## Input

The caller provides:
- A feature description, user need, or rough idea. This is the seed for the story.
- Exploration findings may accompany it — including diagrams (Mermaid, ASCII, or inline markdown). When provided, use them as context: the story should align with the explored scope, decisions, and recommended approach.
- If `$ARGUMENTS` is empty, ask the user what feature or need they want to capture.

## Step 1: Load the user-story skill

Load the `@user-story` skill now. Follow its format, anti-patterns, and quality checks for the rest of this skill. Every story produced must pass the user-story skill's validation.

## Step 2: Analyze the codebase

Use `glob` and `grep` to locate the relevant files, components, types, and patterns that the feature touches. Read the key files to understand:

- **Who** the users are (check auth, roles, user models, route guards)
- **What** the current state is (existing components, API endpoints, data models, types)
- **Where** the change would land (file paths, directory structure, module boundaries)
- **Why** it matters (business logic, validation rules, existing UX flows)

If exploration findings or diagrams were provided, incorporate them: align the story's scope with the explored boundaries, reference the components and flows the diagram highlights, and respect any out-of-scope decisions the exploration made.

Map the feature description to concrete codebase artifacts:

```
Relevant artifacts:
  Models:    <model names and file paths>
  Components: <component names and file paths>
  Endpoints:  <route or API paths>
  Types:      <type definitions and file paths>
  Patterns:   <architectural patterns in use (FSD, monolith, etc.)>
```

## Step 3: Draft the user story

Write the story using the user-story skill's format. Ground every field in the codebase analysis from Step 2:

### Use Case

- **As a** [specific persona derived from auth/roles/user models in the repo — never "user"]
- **I want to** [action that maps to a concrete code change — reference the component, endpoint, or model involved]
- **so that** [real outcome tied to business logic or UX flow found in the codebase]

### Acceptance Criteria (Gherkin)

Write scenarios with preconditions grounded in the actual codebase state:

- **Scenario:** [brief description]
- **Given:** [precondition referencing real state — e.g. "the user is authenticated via the JWT middleware in src/auth/middleware.ts"]
- **and Given:** [additional preconditions — existing data models, current UI state, config values]
- **When:** [trigger that maps to a concrete user action on a real component or endpoint]
- **Then:** [testable outcome referencing actual system behavior — e.g. "the response from POST /api/projects includes the new projectId field defined in src/types/Project.ts"]

### Edge Cases

List 2-3 edge cases derived from what the code currently does:

- What happens when [existing validation/constraint] is violated?
- What if [existing data state] is empty/null/migration-incomplete?
- What about [existing role/permission boundary]?

### Summary

Write a one-line value-focused summary (not a feature title).

## Step 4: Humanize

Load the `@humanizer` skill and run it on the drafted story text from Step 3. AI-generated stories tend to:

- Overuse em dashes and rule-of-three lists
- Use promotional language ("seamless", "powerful", "comprehensive")
- Use passive voice and negative parallelisms
- Stack vague attributions
- Inflate symbolism in the summary line

Apply the humanizer's audit → fix loop to all prose in the story: the summary, the use case, the scenario descriptions, and the edge case notes. Preserve all technical details, file paths, component names, and Gherkin structure — the humanizer cleans prose, not structure or accuracy.

## Step 5: Diagram (when the story has a flow)

If the story involves a user journey, state transition, or component interaction that benefits from visualization, produce a Mermaid diagram. Keep it minimal: the happy path only, no exhaustive enumeration of every branch.

When to draw:
- Multi-step flows (login → action → confirmation)
- State transitions (status changes on a work item, order state machine)
- Component interactions (frontend → API → service → DB)

When to skip:
- Simple CRUD on a single resource
- Stories with a single step and no preconditions beyond auth

If the input included an exploration diagram, extend it with the story's new flow rather than redrawing from scratch.

## Step 6: Validate

Run every quality check from the user-story skill:

- No generic "As a user" — the persona must be specific and grounded in repo context
- "So that" must express real motivation, not restate "I want to"
- Single When / single Then per scenario — if multiple, note that the story should split
- Thens must be testable and measurable — reference real system behavior, not vague improvements
- No technical tasks disguised as user stories (if there's no user outcome, say so)

If any check fails, fix the story and re-validate. Do not show a story to the user that fails validation.

## Step 7: Present the story

Display the complete user story to the user:

- Summary
- Use Case (As a / I want to / so that)
- Acceptance Criteria (all scenarios with full Given/When/Then)
- Edge Cases
- Diagram (if produced in Step 5)
- Codebase artifacts the story is grounded in (file paths, component names, types)

## Step 8: Ask what's next

Call the `question` tool:

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

Do not create any files. Do not run `/plan-propose` or `/plan-quick` automatically. The only output is the user story.
