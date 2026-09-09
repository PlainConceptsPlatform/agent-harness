---
name: pc-userstory
description: Parse work item from any URL using browser automation. Use when user provides a URL that doesn't match GitHub/Azure/Jira CLI platforms, or when backlog platform is 'browser'.
license: MIT
compatibility: Requires agent-browser CLI installed and openspec CLI.
metadata:
  author: copilots
  version: "2.0"
---

Read a work item off its own web page, for a backlog with no CLI, then hand the change to `pc-plan-propose`. This is the fallback: a GitHub, Azure DevOps or Jira URL belongs to the CLI skill for that platform, which is faster and cannot misread a page.

Browser is a backlog-only platform. Shipping runs on whichever repo platform the project configured.

## Rules

- Navigate only to a URL the user gave you. This skill is the one exception to `browser-automation`'s ban on leaving localhost, and it is that narrow on purpose: a work-item page is behind the user's own login, and anything else reachable from it is too.
- Read only. No clicking, no status changes, nothing written back to the tracker.
- Always reuse the `backlog` session so the login survives; a login page instead of the work item means the session is not authenticated, and the user has to log in manually in the opened window before a retry.

## Contracts

`agent-browser` runs its own Chrome, not the user's daily browser, and keeps state per session:

```bash
agent-browser --session backlog --restore open "https://the-url-the-user-provided"
agent-browser wait --load networkidle
agent-browser snapshot
```

`agent-browser doctor` verifies the install. The accessibility tree from `snapshot` locates fields more reliably than page text; `agent-browser read` and `agent-browser get text "h1"` fill the gaps, and `agent-browser get url` confirms the page did not navigate away. A single-page app that renders after idle needs a second wait (`--text "<known heading>"` when a stable string exists) and a fresh snapshot, not a sleep.

Take the title, description with its acceptance criteria or definition of done, the ID from the URL or the page, and status, assignee, priority and labels when they are visible. Where to look, by tool:

| Tool | Work item URL | Title | Description |
|---|---|---|---|
| Azure DevOps | `/_workitems/edit/{id}` | header | "Description" and "Acceptance Criteria" sections |
| Linear | `/{team}/issue/{key}` | issue title | issue body |
| Jira | `/browse/{key}` | summary | description field |
| Trello | `/c/{short-id}` | card title | card description |
| Anything else | as given | `<h1>` or page title | main content area |

Then create the change, whose `proposal.md` names the source URL and the work item ID:

```bash
openspec new change "{slug-from-title}"
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
