---
name: pc-userstory
description: Parse GitHub Issue URL and create OpenSpec change. Use when user provides a GitHub Issue URL.
license: MIT
compatibility: Requires openspec CLI and gh CLI.
metadata:
  author: copilots
  version: "1.1"
---

Turn a GitHub Issue URL into an OpenSpec change, then hand the change to `pc-plan-propose`.

## Rules

- Issue data comes from `gh`, never from a page fetch (denied by `pc-system-reminders`). An unavailable or unauthenticated `gh` is a blocker to report: `gh auth status` says which.
- Always pass `--repo {owner}/{repo}`. Git context resolves to the wrong repository in a fork or a worktree, and the failure looks like a missing issue.
- Never load `pc-plan-apply` until the user has said yes.

## Contracts

`https://github.com/{owner}/{repo}/issues/42` gives owner, repo and number `42`.

```bash
gh issue view 42 --repo {owner}/{repo} --json number,title,body,labels,milestone,state
```

An auth error or a 404 here is the blocker; do not work around it. From the JSON take `number`, `title`, `body` (description and acceptance criteria), `labels`, `milestone` and `state`.

```bash
openspec new change "gh-{number}-{slug}"
```

Screenshots live in the change folder, `openspec/changes/{change-name}/images/{name}.png`, and embed as a blob URL pinned to a commit SHA with `?raw=true`: `https://github.com/{owner}/{repo}/blob/{sha}/openspec/changes/{change}/images/{file}.png?raw=true`.

Report:

```
## Issue Parsed

Issue: #{number}
Title: {title}
State: {state}
Milestone: {milestone}

Change Created: gh-{number}-{slug}
```

Then load `pc-plan-propose` (interactive) and, once it returns, ask:

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
