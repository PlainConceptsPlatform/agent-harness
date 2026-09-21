---
name: pc-userstory
description: Parse a Jira work item and create an OpenSpec change. Use when the user provides a Jira URL or a bare issue key (e.g. PROJ-123).
license: MIT
compatibility: Requires openspec CLI and Atlassian CLI (acli).
metadata:
  author: copilots
  version: "1.0"
---

Turn a Jira issue into an OpenSpec change, then hand the change to `pc-plan-propose`. Jira is backlog-only: it has no repositories and no pull requests, so shipping runs on whichever repo platform the project configured.

## Rules

- Issue data comes from `acli`, never from a page fetch or a browser (denied by `pc-system-reminders`). An `acli` that cannot authenticate is a blocker to report; install and login are documented at https://developer.atlassian.com/cloud/acli/guides/install-acli/.
- Never transition the work item without asking, and never transition one that is not in `To Do` or `Backlog`. Moving somebody's ticket is visible to their whole team.
- In an unattended run, skip the question and the transition rather than resolving it yes.
- Never load `pc-plan-apply` until the user has said yes.

## Contracts

The key is `PROJ-123`, taken from `/browse/PROJ-123`, `/jira/core/projects/PROJ/issues/PROJ-123`, `?selectedIssue=PROJ-123`, or given bare.

```bash
acli jira workitem view --key "PROJ-123"
```

From the output take the summary (title), the description (context), acceptance criteria wherever they live (spec requirements), labels, status, assignee and priority.

```bash
acli jira workitem transition --key "PROJ-123" --status "In Progress"
```

Ask before that one:

```json
{
  "questions": [
    {
      "header": "Transition work item",
      "question": "Move {KEY} to In Progress?",
      "options": [
        { "label": "yes", "description": "Transition the work item to In Progress." },
        { "label": "no", "description": "Skip the transition." }
      ]
    }
  ]
}
```

Then create the change, whose `proposal.md` names the Jira key and links back to it:

```bash
openspec new change "{slug-from-summary}"
```

Load `pc-plan-propose` (interactive) and, once it returns, ask:

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

Also available: `acli jira workitem search --jql "..."` and `acli jira workitem comment create --key "PROJ-123" --body "..."`.
