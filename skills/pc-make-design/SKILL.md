---
name: pc-make-design
description: Generate or update DESIGN.md by analyzing the codebase design system (Tailwind, CSS vars, tokens, UI framework config). Safe to run at any time. Invoked by the /make-design command and the repo-initialize flow.
license: MIT
---

# Make Design

Write `DESIGN.md` in the project root from the design system the codebase actually uses.

The format is Google's design.md spec:

- Overview: https://stitch.withgoogle.com/docs/design-md/overview/
- Format: https://stitch.withgoogle.com/docs/design-md/format/
- Spec and examples: https://github.com/google-labs-code/design.md

## Rules

- Never regenerate over a file that carries a `<!-- Last updated:` footer. That footer is what makes the next run incremental, and a full rewrite silently drops whatever a human added by hand. Read the file first and pick the mode.
- Never reference a file, variable or path from the codebase. `DESIGN.md` is handed to tools that cannot see this repository, so it has to stand alone.
- Never analyze outside `.opencode/source-roots.json` when it exists.

## Contract

YAML frontmatter holding every structured token (colours, typography, spacing, elevation, motion, radii, shadows), valid as YAML design tokens. Then free-form Markdown for the look and feel, which is where intent that token values cannot carry belongs. The last line is the run's own ISO timestamp:

```
<!-- Last updated: <ISO date> -->
```

## Modes

| The existing file | Mode |
|---|---|
| Missing, or a placeholder with no real content | Generate |
| Has content and a `<!-- Last updated:` footer | Update |
| Has content but no footer | Warn the user, then Generate |

**Generate.** `glob` for CSS, Tailwind and PostCSS config, component files, token definitions (JS, TS, JSON, YAML), theme files, and UI framework config (shadcn, MUI, Chakra).

**Update.** `git log --oneline --since="<footer date>" -- <source roots>` says what moved. Nothing changed means nothing to write: say "Design system unchanged since last update" and stop. Otherwise update only the affected tokens and sections. A replaced token system is a Generate.

## Report

Whether the file was generated or updated and which tokens changed, the palette, fonts and spacing scale found, and that `/make-design` can be re-run whenever the design system moves.
