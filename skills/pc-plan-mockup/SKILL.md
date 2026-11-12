---
name: pc-plan-mockup
description: Build a self-contained HTML mockup of a UI change from this repository's own design tokens and components, so a person and the implementing agent agree on the experience before any code is written. The mockup states UX intent, not a spec. Use when a feature touches the frontend and the layout, flow or states are worth seeing. Invoked by the /plan-mockup command (interactive) and by the refine workflow (autonomous).
license: MIT
---

Draw the change before building it. The mockup answers one question: is this the experience we mean? It is never the implementation. The real components, `DESIGN.md` and `ARCHITECTURE.md` decide how it is built, and the mockup tells the implementer which of those components each part of the screen should be.

[The contract](mockup-contract.md) defines the files, the HTML rules and `mockup.json`. Read it before writing anything.

## Input

A feature idea, an exploration brief from `/plan-explore`, a story from `/plan-story`, or an issue. Ask what screen or flow to draw only when none of those says.

## Modes

- `interactive` (default): the person is here. Show the mockup, ask what to change, iterate until they are happy.
- `autonomous`: a workflow called this skill and gave an output directory. Ask nothing. Write `index.html` and `mockup.json` there and stop.

<!-- PC-OPTIMIZATION-MEMORY-START -->
<!-- PC-OPTIMIZATION-MEMORY-END -->

## Rules

- Never use a component, colour or font the repository does not have. When the screen needs something that does not exist, mark it `new:<Name>` so the implementer knows it is new work.
- Never load anything from outside the file, and never use a utility framework runtime. Plain CSS from the tokens keeps it approximate, and approximate is the point.
- Never touch the source tree. The mockup lives in `.mockups/` locally and on the `mockups` branch once published.
- Data is invented. No real names, customers or email addresses, even ones the conversation used.

## Flow

1. **Tokens.** Find `DESIGN.md` at the root, or in `ai/` or `docs/`. Read its frontmatter by meaning, not by exact key: `color.primitives.brand-blue` and `color.primitive.brand_blue` are the same token. If it is missing or still the placeholder, in interactive mode run `/make-design` first; in autonomous mode read the theme stylesheet the web app imports and set `designSource` to `theme-css`.

2. **Components.** List the UI components the area uses: the shared UI folder (often `src/shared/ui/` or `src/components/ui/`), the feature's own components, and the packages they import from. Read the few the screen needs, enough to draw them with the right anatomy (a table's header and pagination, a sheet's footer actions), never to copy their code.

3. **States.** Decide which states the scenario can reach: empty, loading, error, success, disabled, mobile, or one the issue names. Draw only those.

4. **Method.** If `@html-prototype` is installed, load it and use it in mockup mode for how to scope the flow, model states and check widths. This skill stays the authority on look and components.

5. **Write.** `index.html` and `mockup.json`, as the contract says. Tag every region with `data-mockup-section` and every component stand-in with `data-component`. Interactive mode writes to `.mockups/<slug>/` and adds `.mockups/` to `.gitignore` when it is missing; autonomous mode writes to the directory it was given.

6. **Check.** Open the file at 1440 and 390 pixels wide, with `@browser-automation` when it is available, and save `desktop.png` and `mobile.png` beside it. Look for overflow, unreadable contrast and empty regions. Without a browser, say which checks did not run.

7. **Hand off.** In interactive mode, show the screenshots and the component table (section, element, component, path), then ask what next.

## Publish

When the person picks Publish, or names an issue, put the folder on the `mockups` branch so the refine and implement workflows find it:

```bash
issue=<number>
dir=$(mktemp -d)
git fetch origin mockups 2>/dev/null || true
if git rev-parse --verify -q origin/mockups >/dev/null; then
  git worktree add "$dir" origin/mockups --detach
else
  git worktree add --detach "$dir" && git -C "$dir" checkout --orphan mockups && git -C "$dir" rm -rfq .
fi
rm -rf "$dir/issue-$issue" && mkdir -p "$dir/issue-$issue"
cp .mockups/<slug>/* "$dir/issue-$issue/"
git -C "$dir" add "issue-$issue"
git -C "$dir" commit -m "mockup: issue #$issue [skip ci]"
git -C "$dir" push origin HEAD:refs/heads/mockups
git worktree remove --force "$dir"
```

Set `issue` in `mockup.json` before copying. Then comment on the issue with a link to `issue-<number>/index.html` on that branch, the desktop screenshot when there is one, the component table and the line `UX mockup: intent, not a spec. Build with the components listed.` Use the repository's platform CLI for the comment; when there is none, give the person the text to paste.

## Contracts

```json
{
  "questions": [
    {
      "header": "What next",
      "question": "What next?",
      "options": [
        { "label": "Change the mockup", "description": "Say what to move, add or remove." },
        { "label": "/plan-story", "description": "Write the user story, with this mockup in its UX section." },
        { "label": "Publish", "description": "Put the mockup on the mockups branch and link it from an issue." }
      ]
    }
  ]
}
```
