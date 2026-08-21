---
name: pc-make-architecture
description: Generate or update ARCHITECTURE.md by analyzing the codebase structure. Safe to run at any time. Invoked by the /make-architecture command and the repo-initialize flow.
license: MIT
---

# Make Architecture

Analyze the architecture of this codebase and generate or update `ARCHITECTURE.md` in the project root.

## Steps

1. **Check current state**

   Read `ARCHITECTURE.md`. Determine which mode to use:
   - Does not exist or is a placeholder (no real content): Generate mode. Create from scratch.
   - Exists with content and has a `<!-- Last updated:` footer: Update mode. Incrementally update (see step 2b).
   - Exists with content but no timestamp: warn the user, then proceed in Generate mode (full regeneration).

2a. **Generate mode: analyze the codebase**

   Read `.opencode/source-roots.json` when present. Only analyze those roots plus this repo's docs/config files.

   Use file tools to discover the architecture: `glob` for folder structure, `grep` for route/model/schema definitions, `read` config files, CI/CD workflows, Dockerfiles, README, changelogs, ADRs.

2b. **Update mode: incremental analysis**

   Extract the `<!-- Last updated: <ISO date> -->` timestamp from the existing file. Then:
   - Run `git log --oneline --since="<date>" -- <source roots>` to find what changed since the last analysis.
   - If nothing changed: report "Architecture unchanged since last update" and stop.
   - For each changed area, understand what's affected.
   - Update only the affected sections. Preserve manually-added content in unchanged sections.
   - If the changes are too pervasive (more than ~40% of sections affected), fall back to Generate mode.

3. **Write ARCHITECTURE.md**

   Write (or update) `ARCHITECTURE.md` following the [structure template](structure-template.md) reference. That reference defines every section, the rules for writing, and the timestamp footer format.

4. **Store summary in configured persistent context**

   `write_note` MCP tool with title `architecture-summary` containing:
   - The ISO timestamp of this run
   - A bullet list of top-level components found (every top-level component must appear)
   - Any key architectural decisions or risks identified

5. **Report**

   Tell the user:
   - Whether ARCHITECTURE.md was generated or updated (and which sections changed)
   - Top-level components found
   - Tip: "Rerun `/make-architecture` any time the architecture changes significantly."
