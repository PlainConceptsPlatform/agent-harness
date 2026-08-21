---
name: pc-make-design
description: Generate or update DESIGN.md by analyzing the codebase design system (Tailwind, CSS vars, tokens, UI framework config). Safe to run at any time. Invoked by the /make-design command and the repo-initialize flow.
license: MIT
---

# Make Design

Analyze the design system of this codebase and generate or update `DESIGN.md` in the project root.

Reference material:
  Overview: https://stitch.withgoogle.com/docs/design-md/overview/
  Format: https://stitch.withgoogle.com/docs/design-md/format/
  Spec: https://github.com/google-labs-code/design.md

Examples from the spec repo:
  https://github.com/google-labs-code/design.md/blob/main/examples/atmospheric-glass/DESIGN.md
  https://github.com/google-labs-code/design.md/blob/main/examples/paws-and-paths/DESIGN.md

## Steps

1. **Check current state**

   Read `DESIGN.md`. Determine which mode to use:
   - Does not exist or is a placeholder (no real content): Generate mode. Create from scratch.
   - Exists with content and has a `<!-- Last updated:` footer: Update mode. Incrementally update (see step 2b).
   - Exists with content but no timestamp: warn the user, then proceed in Generate mode (full regeneration).

2a. **Generate mode: analyze the codebase**

   Read `.opencode/source-roots.json` when present. Only analyze those roots.

   Use file tools to discover the design system: `glob` for CSS files, Tailwind config, PostCSS config, component files, design token definitions (JS/TS/JSON/YAML), theme files, UI framework config (shadcn, MUI, Chakra, etc.).

2b. **Update mode: incremental analysis**

   Extract the `<!-- Last updated: <ISO date> -->` timestamp from the existing file. Then:
   - Run `git log --oneline --since="<date>" -- <source roots>` to find what changed since the last analysis.
   - If nothing changed: report "Design system unchanged since last update" and stop.
   - For changed CSS/token/component files, understand what uses them.
   - Update only the affected tokens and sections. Preserve manually-added content in unchanged sections.
   - If the changes are too pervasive (entire token system replaced), fall back to Generate mode.

3. **Write DESIGN.md**

   Write (or update) `DESIGN.md`. The output must:
   - Begin with YAML frontmatter containing all structured design tokens (colors, typography, spacing, elevation, motion, radii, shadows, etc.)
   - Follow with free-form Markdown describing the look and feel and capturing design intent that token values alone cannot convey
   - Be entirely self-contained: reference no files, variables, or paths from the codebase
   - Use valid YAML design token format for all token values

   Append at the very end of the file:
   ```
   <!-- Last updated: <current ISO timestamp> -->
   ```

4. **Store summary in configured persistent context**

   `write_note` MCP tool with title `design-summary` containing:
   - The ISO timestamp of this run
   - Key design tokens found (color palette, fonts, spacing scale)

5. **Report**

   Tell the user:
   - Whether DESIGN.md was generated or updated (and which tokens/sections changed)
   - Key design tokens found (color palette, fonts, spacing scale)
   - Tip: "Rerun `/make-design` any time your design system changes."
