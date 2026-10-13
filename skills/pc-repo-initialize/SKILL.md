---
name: pc-repo-initialize
description: "Initialize the project. Presents a single form with all setup questions, then executes selected steps. Invoked by the /init command (alias: /repo-initialize)."
license: MIT
---

First read `AGENTS.md`. Without the `<!-- PC-NOT-INITIALIZED -->` marker the project is already initialized: say so, and point at `/make-architecture` or `/make-design` for a refresh. With it, run the sequence below.

## Rules

- Write only to `ARCHITECTURE.md`, `DESIGN.md`, `AGENTS.md`, `openspec/` and `.agents/skills/`. Source files are read for analysis, never edited: init sets a project up, it does not implement anything, and it creates no branches or pull requests.
- Ask the five questions in one `question` call. Five separate prompts is five chances for the user to walk away from a setup that does nothing until it finishes.
- A step whose answer was No is skipped, not approximated.

## Step 1, Ask everything at once

```json
{
  "questions": [
    {
      "header": "Type",
      "question": "What type of project is this?",
      "options": [
        { "label": "brownfield", "description": "Existing codebase. Generate docs from your code." },
        { "label": "greenfield", "description": "Starting from scratch, little or no existing code." }
      ]
    },
    {
      "header": "History",
      "question": "Archive project history into OpenSpec?",
      "options": [
        { "label": "Yes", "description": "Scan codebase for existing docs, changelogs, decisions and archive them." },
        { "label": "No", "description": "Skip history archival." }
      ]
    },
    {
      "header": "Architecture",
      "question": "Generate ARCHITECTURE.md from the codebase?",
      "options": [
        { "label": "Yes", "description": "Analyze project structure and generate architecture documentation." },
        { "label": "No", "description": "Skip, leave as placeholder." }
      ]
    },
    {
      "header": "Design",
      "question": "Generate DESIGN.md from the design system?",
      "options": [
        { "label": "Yes", "description": "Analyze Tailwind, CSS vars, tokens and generate design documentation." },
        { "label": "No", "description": "Skip, leave as placeholder." }
      ]
    },
    {
      "header": "Evidence",
      "question": "Record how the app starts and how a person signs in locally, so merged changes get screenshots?",
      "options": [
        { "label": "Yes", "description": "Fill the project environment in pc-repo-verify: start command, URL, local sign-in, seeded data." },
        { "label": "No", "description": "Skip; the verification plans will look for the sign-in themselves." }
      ]
    }
  ]
}
```

## Step 2, Sync skills

Always. `npx skills experimental_install --yes` in the project root installs what onboarding queued in `skills-lock.json`. A failure here is a warning, not a stop: the optional ones can be added later.

## Step 3, Archive project history

If Yes. Scan the roots in `.opencode/source-roots.json` (plus this repo's own docs and config) for documentation, changelogs, ADRs, READMEs and anything else that records how the project got here. Then:

```bash
openspec new change "project-history"
```

Write a `proposal.md` in it covering what the project is, the decisions already taken, the tech debt and constraints the code shows, and where things stand. Archive it immediately, with `-y` so it cannot block:

```bash
openspec archive "project-history" -y
```

## Step 4, Generate ARCHITECTURE.md

If Yes. Load `pc-make-architecture`.

## Step 5, Generate DESIGN.md

If Yes. Load `pc-make-design`.

## Step 6, Generate guardrails

Always. Load `pc-make-guardrails`.

## Step 7, Visual evidence

If Yes. Every change's verification plan (`pc-repo-verify`) is replayed in headless Chromium by the evidence workflow when its pull request merges, from a freshly started app with nothing in the browser. Find in the source, and confirm by reading the root `package.json`, `.env.example` and the local auth setup:

- the command that starts the whole stack with mock authentication (normally `pnpm run dev` at the root),
- the URL the web app answers on,
- the local sign-in: the exact steps and visible labels of the mock account picker or dev login,
- the data a fresh start seeds (accounts, records) that a journey can rely on.

Write them as the bullet list between `<!-- PC-PROJECT-ENVIRONMENT-START -->` and `<!-- PC-PROJECT-ENVIRONMENT-END -->` in `.agents/skills/pc-repo-verify/SKILL.md`, replacing the placeholder bullets. Only that slot: the rest of the file is the harness's, and an update keeps only the slot.

## Step 8, Show help

Load `pc-repo-help` and display the command reference as written.

## Step 9, Confirm

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Initialization complete.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Restart OpenCode now.
Nothing will work correctly until you do.
After restarting you are ready to work.
```
