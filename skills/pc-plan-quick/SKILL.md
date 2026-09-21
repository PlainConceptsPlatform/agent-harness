---
name: pc-plan-quick
description: "Quick plan: analyze the codebase and create a task checklist using the Todo pane. No files, no OpenSpec. Invoked by the /plan-quick command."
license: MIT
---

Lightweight planning for a change that is already clear: read the codebase, write the task list to the Todo pane, stop. Use `/plan-explore` then `/plan-propose` instead when the idea is half-formed, the alternatives need thinking through, or the result should outlive the session.

## Rules

- Never write, edit, or create a file. The only artefacts are Todo items and one question, so there is nothing to review afterwards and nothing to undo.
- Never start the work, and never invoke `/plan-apply` or `/plan-propose` on the user's behalf. The question at the end is where they choose.

## Contracts

One Todo item per task, in dependency order, each one action naming the files it touches:

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

Then ask:

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
