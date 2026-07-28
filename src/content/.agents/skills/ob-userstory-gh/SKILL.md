---
name: ob-userstory
description: Parse GitHub Issue URL and create OpenSpec change. Use when user provides a GitHub Issue URL.
license: MIT
compatibility: Requires openspec CLI and gh CLI.
metadata:
  author: copilots
  version: "1.1"
---

Use `gh` CLI for all GitHub operations. If `gh` is unavailable, report it as a blocker.

## GitHub CLI Setup (One-Time)

```bash
gh auth login
# Follow prompts, authenticate via browser or token
```

Verify:
```bash
gh auth status
```

## Steps

1. **Extract owner, repo, and issue number** from URL
   - `https://github.com/{owner}/{repo}/issues/42` -> owner: `{owner}`, repo: `{repo}`, number: `42`

2. **Fetch Issue**, always pass `--repo` explicitly:
   ```bash
   gh issue view 42 --repo {owner}/{repo} --json number,title,body,labels,milestone,state
   ```
   If this returns an auth error or 404, report as a blocker.

3. **Extract Key Fields** from JSON response:
   - `number` -> Issue number
   - `title` -> Title
   - `body` -> Description / acceptance criteria
   - `labels` -> Labels
   - `milestone` -> Milestone / sprint equivalent
   - `state` -> State (open/closed)

4. **Create OpenSpec Change**
   ```bash
   openspec new change "gh-{number}-{slug}"
   ```

5. **Hand off to proposal.** Load the `ob-plan-propose` skill (interactive mode) to generate the proposal, specs, and tasks. After it completes, call the `question` tool:

   ```json
   {
     "questions": [
       {
         "header": "Ready to implement",
         "question": "Ready to implement?",
         "options": [
           { "label": "yes", "description": "Load the ob-plan-apply skill to start implementation." },
           { "label": "no", "description": "Stop here. You can run /plan-apply later." }
         ]
       }
     ]
   }
   ```

   Wait for confirmation before loading `ob-plan-apply`.

## Full GitHub CLI Reference

Always pass `--repo {owner}/{repo}`, relying on git context is unreliable.

### Issues
```bash
# Read issue
gh issue view <number> --repo {owner}/{repo}

# List open issues
gh issue list --repo {owner}/{repo} --state open --limit 10

# Update issue
gh issue edit <number> --repo {owner}/{repo} --add-label "in-progress"
```

## Screenshot / Image Strategy

Save to openspec change folder and reference via GitHub blob URL pinned to commit SHA. Keep `?raw=true` when embedding in markdown:

```
openspec/changes/{change-name}/images/{screenshot}.png
```

```
https://github.com/{owner}/{repo}/blob/{sha}/openspec/changes/{change}/images/{file}.png?raw=true
```

## URL Formats Reference

```
# Issue
https://github.com/{owner}/{repo}/issues/{number}

# PR
https://github.com/{owner}/{repo}/pull/{number}

# Blob file
https://github.com/{owner}/{repo}/blob/{sha}/{path}
```

## Output Format

```
## Issue Parsed

Issue: {number}
Title: {title}
State: {state}
Milestone: {milestone}

Change Created: gh-{number}-{slug}
```
