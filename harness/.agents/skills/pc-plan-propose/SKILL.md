---
name: pc-plan-propose
description: Parse a work item or idea and produce an OpenSpec change plan (proposal.md, specs, tasks.md) with enriched task assignments (agent, tier, depends_on, touches). Load when turning a requirement into a structured plan. Invoked by the /plan-propose command (interactive) and the plan-goal pipeline (autonomous).
license: MIT
---

# Plan Propose

**READ-ONLY UNTIL CONFIRMED.** Until the Step 3 checkpoint resolves to `yes`, this entire skill is read-only. You MUST NOT write, edit, or create any file. Build everything in context. Files hit disk only in Step 4. After Step 5, the skill ends; if the user keeps chatting without invoking a new command, remain read-only. Writing requires either an explicit user command (e.g. `/plan-apply`) or the Step 3 `yes` confirmation.

## Input

The caller provides:
- A work item URL, issue key, or direct feature description. Exploration findings may accompany it; incorporate them.
- Optionally a mode (see below). Default: `interactive`.

## Modes

- `interactive` (default): every checkpoint below is active. Wait for the user at each one.
- `autonomous`: there is no user. Never ask anything. Each checkpoint marked with a stop sign states its autonomous resolution inline.

## Step 0.a: Check for unarchived changes (stop)

Before proposing a new change, inspect `openspec/changes/` (ignore `openspec/changes/archive`).
If any change folder exists in `openspec/changes/` (names vary by platform: `gh-*`, `us-*`, or a plain slug), list them in the question text, then call the `question` tool:

```json
{
  "questions": [
    {
      "header": "Unarchived changes",
      "question": "There are unarchived changes pending:\n{change-name}\n{change-name}\n...\n\nContinue with the proposal or stop to archive first?",
      "options": [
        { "label": "continue", "description": "Proceed with the proposal." },
        { "label": "stop", "description": "End without generating a proposal. Archive the pending change first." }
      ]
    }
  ]
}
```

- If the user answers `stop`, end without generating a proposal.
- If the user answers `continue`, proceed to the next step.

Autonomous mode: do not call the `question` tool; treat the answer as `continue` and proceed.

## Step 0.b: Load proposal skill

If a work item URL or issue key is provided (GitHub Issue, Azure DevOps work item, Jira issue, or browser-based backlog): load `@pc-userstory` skill and fetch the work item before continuing. Backlog platform is set in `.opencode/harness.json` -> `platform.backlog`. If backlog platform is `none`, skip this step and work from direct input.

## Step 1: Generate the proposal in memory

Load `@openspec-propose` skill and follow its instructions to generate proposal.md, specs, and tasks.md. Do not write them to disk yet. Build the complete proposal content in your context.

## Step 2: Enrich task assignments

1. List every `*-engineer.md` file in `.opencode/agents/`. For each file read:
   - `description:` from the YAML frontmatter: the engineer's specialization summary
   - `## Abilities` section: the skills listed under Development, Testing, Infrastructure (e.g. `@nodejs-backend`, `@secure-nextjs-api-routes`)
   Build a map of `agent-name -> { description, abilities }`.
2. For each task, compare the task text and domain against every engineer's description AND abilities. Pick the engineer whose combined profile most closely matches. `fullstack-engineer` is the fallback worker and the body behind `build` and `plan`; prefer a real specialist over it, and never annotate a task with `build` or `plan`, which are the user's own primaries. If no specialist matches a task, leave the agent field blank and record the missing specialization in the proposal. An annotated OpenSpec task needs a real subagent; never substitute the lead or an obsolete generic agent name.
3. Pick a tier, derive `depends_on`, derive `touches`, and annotate each task line. Follow the [task annotation](task-annotation.md) reference for the full tier selection guide, dependency derivation, touches derivation, and annotation format with examples.

## Step 3: Show the plan and ask for confirmation (stop)

Display the complete proposal to the user:
- Change name and description
- Total task count
- Full task list with agent (including tier suffix) and dependency annotations

Then call the `question` tool:

```json
{
  "questions": [
    {
      "header": "Save proposal",
      "question": "Save this proposal?",
      "options": [
        { "label": "yes", "description": "Write all files to disk and proceed." },
        { "label": "edit", "description": "Provide feedback, revise in memory, show again." },
        { "label": "stop", "description": "End without writing anything." }
      ]
    }
  ]
}
```

- `yes` -> proceed to Step 4 and write all files
- `edit` -> user provides feedback, revise in memory, show again, ask again
- `stop` -> end without writing anything

Wait for the user's response. Do not proceed without a response.

Autonomous mode: do not call the `question` tool; treat the answer as `yes` and write the files immediately.

## Step 4: Write (only after the Step 3 checkpoint resolves)

Write the proposal files to `openspec/changes/{change-slug}/`:
- `proposal.md`: the change description and rationale
- `specs/`: any spec files generated
- `tasks.md`: the enriched task list with agent annotations

## Step 5: Stop (stop)

Call the `question` tool:

```json
{
  "questions": [
    {
      "header": "Ready to implement",
      "question": "Ready to implement?",
      "options": [
        { "label": "yes", "description": "Load the pc-plan-apply skill to start implementation." },
        { "label": "no", "description": "Stop here. You can run /plan-apply later." }
      ]
    }
  ]
}
```

Loading `pc-plan-apply` requires explicit user confirmation.

Autonomous mode: do not call the `question` tool. The PROPOSE stage is complete. Hand the change slug and task count back to the caller (the `/plan-goal` pipeline) so it immediately continues to the apply phase. This is a stage boundary, not the end of the run.
