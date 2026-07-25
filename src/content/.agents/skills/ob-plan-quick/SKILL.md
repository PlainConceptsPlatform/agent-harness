---
name: ob-plan-quick
description: Quick plan: analyze the codebase and create a task checklist using the Todo pane. No files, no OpenSpec. Invoked by the /plan-quick command.
license: MIT
---

This command is strictly read-only. You may read files, search code, and use `todowrite` to create Todo pane items. You MUST NOT write, edit, or create any file. After completing the checklist and asking the user what's next, if the user continues chatting without invoking a new command (e.g. `/plan-apply`) or explicitly requesting implementation, remain read-only. The only output of this command is the Todo pane checklist and a question to the user.

Lightweight planning for focused changes. Reads the codebase, creates a task checklist in the Todo pane using `todowrite`, and stops. This is a thinking tool, not a file writer.

When to use this instead of `/plan-explore` then `/plan-propose`:
- The task is clear and well-scoped (not a half-formed idea)
- You don't need to think through alternatives or investigate deeply
- You want a task list in under a minute, not a full proposal

## Step 1: Understand the task

Read the user's description. Use `glob` and `grep` to locate the relevant files, components, and patterns in the codebase. Read the key files to understand what exists and what needs to change.

## Step 2: Create the plan in the Todo pane

Use `todowrite` to create one todo item per task. Each item must be:

- Concrete and actionable: include file paths or areas in the task text when possible
- Ordered by logical dependency: dependencies first
- Granular: one clear action per item, not a bundle

Example `todowrite` call:

```json
{
  "todos": [
    { "content": "Add Project model to src/types.ts", "status": "pending", "priority": "high" },
    { "content": "Add projectId field to LoopOptions in src/types.ts", "status": "pending", "priority": "high" },
    { "content": "Create Project RPC endpoints in src/rpc/project/", "status": "pending", "priority": "medium" },
    { "content": "Build Accept page UI in src/board/components/CreateForm.tsx", "status": "pending", "priority": "medium" },
    { "content": "Run typecheck and fix errors", "status": "pending", "priority": "low" }
  ]
}
```

## Step 3: Ask what's next

Call the `question` tool:

```json
{
  "questions": [
    {
      "header": "What next",
      "question": "What next?",
      "options": [
        { "label": "/plan-apply", "description": "Implement these tasks now (creates a feature branch and works through them)." },
        { "label": "/plan-propose", "description": "Turn this into a full OpenSpec proposal with agent assignments." },
        { "label": "Start on specific tasks", "description": "Tell me which tasks to start on." }
      ]
    }
  ]
}
```

Do not create any files. Do not run `/plan-apply` or `/plan-propose` automatically. The only output is the Todo pane checklist.
