---
name: pc-userstory
description: Parse work item from any URL using browse browser automation. Use when user provides a URL that doesn't match GitHub/Azure/Jira CLI platforms, or when backlog platform is 'browser'.
license: MIT
compatibility: Requires browse CLI installed, the browser extension paired, and openspec CLI.
metadata:
  author: copilots
  version: "3.0"
---

Read a work item off its own web page, for a backlog with no CLI, then hand the change to `pc-plan-propose`. This is the fallback: a GitHub, Azure DevOps or Jira URL belongs to the CLI skill for that platform, which is faster and cannot misread a page.

Browser is a backlog-only platform. Shipping runs on whichever repo platform the project configured.

## Rules

- Navigate only to a URL the user gave you. A work-item page is behind the user's own login, and anything else reachable from it is too.
- Read only. No clicking, no status changes, nothing written back to the tracker.
- If the page asks for login or 2FA, hand off to the user via `handoff()`. Browse drives the user's real browser with their logins, so most pages are already authenticated.

## Contracts

`browse` drives the user's real browser (Chrome, Edge, etc.) with their existing logins, tabs, cookies, and extensions:

```javascript
// Open the work item URL in the user's browser
await page.goto("https://the-url-the-user-provided", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);

// If we landed on a login page, hand off to the user
if (page.url().includes("/login") || page.url().includes("/signin")) {
  await handoff("Log in to your backlog platform. Click Continue when you're back on the work item page.");
}

// Read the page
const snap = await snapshot();
return snap;
```

`browse doctor` verifies the install. The accessibility tree from `snapshot()` locates fields more reliably than page text; `page.locator("body").innerText()` fills the gaps, and `page.url()` confirms the page did not navigate away. A single-page app that renders after `domcontentloaded` needs an explicit wait for a known heading (`await page.getByText("Issue").waitFor()`) and a fresh snapshot, not a sleep.

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
