---
name: pc-make-architecture
description: Generate or update ARCHITECTURE.md by analyzing the codebase structure. Safe to run at any time. Invoked by the /make-architecture command and the repo-initialize flow.
license: MIT
---

# Make Architecture

Write `ARCHITECTURE.md` in the project root from what the codebase actually contains, following the [structure template](structure-template.md).

## Rules

- Never regenerate over a file that carries a `<!-- Last updated:` footer. That footer is what makes the next run incremental, and a full rewrite silently drops whatever a human added by hand. Read the file first and pick the mode.
- Never analyze outside `.opencode/source-roots.json` when it exists, plus this repo's own docs and config.
- The footer is the file's last line, and it is the run's own ISO timestamp: `<!-- Last updated: <ISO date> -->`.

## Modes

| The existing file | Mode |
|---|---|
| Missing, or a placeholder with no real content | Generate |
| Has content and a `<!-- Last updated:` footer | Update |
| Has content but no footer | Warn the user, then Generate |

**Generate.** Discover the architecture with the file tools: `glob` for structure, `grep` for routes, models and schemas, `read` for config, CI workflows, Dockerfiles, README, changelogs and ADRs.

**Update.** `git log --oneline --since="<footer date>" -- <source roots>` says what moved. Nothing changed means nothing to write: say "Architecture unchanged since last update" and stop. Otherwise rewrite only the affected sections and leave the rest, including anything hand-written, as it stands. Past roughly 40% of sections affected, fall back to Generate.

## Report

Whether the file was generated or updated and which sections changed, the top-level components found, and that `/make-architecture` can be re-run whenever the architecture moves.
