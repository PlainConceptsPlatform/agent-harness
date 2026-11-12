# Mockup contract

What a mockup folder holds, so the people and the workflows that read it can rely on it. The agentic workflows validate a mockup against this file before they render or publish it; a mockup that breaks it is dropped, never fixed up.

## Files

| File | Required | What it is |
|---|---|---|
| `index.html` | yes | The mockup. One file, opens offline in any browser. |
| `mockup.json` | yes | What the mockup claims, in a form a workflow can read without parsing HTML. |
| `desktop.png`, `mobile.png` | no | Screenshots at 1440 and 390 pixels wide. The refine workflow renders them itself when they are missing. |

## `index.html`

- One self-contained file under 400 KB. Styles sit in one inline `<style>`; a small inline `<script>` is allowed for toggling states.
- Nothing is loaded from anywhere: no `http://` or `https://` URL, no `<script src>`, no `<link href>` to a stylesheet, no web font, no image file. Icons are inline SVG or text.
- Colours, radii, spacing and type come from the repository's design tokens, declared once as CSS custom properties on `:root` (and `.dark` when the repository has a dark mode). No utility framework runtime, Tailwind included: the mockup is approximate on purpose, and a runtime would make it look more authoritative than it is.
- The first element in `<body>` is a banner reading `UX mockup: intent, not a spec`.
- Every screen region carries `data-mockup-section="<id>"`, a kebab-case id unique in the file.
- Every element that stands for a real component carries `data-component="<reference>"`:
  - a path relative to the repository root for a component the repository owns, such as `apps/web/src/shared/ui/button.tsx`;
  - a package export for a component it imports, such as `@plainconceptsplatform/ui-components/data-table`;
  - `new:<Name>` for a component that does not exist yet and the change has to build.
- Data is fictional and internally consistent. No real person, customer, email address or identifier.

## `mockup.json`

```json
{
  "version": 1,
  "title": "Claim timeline panel",
  "issue": 42,
  "designSource": "DESIGN.md",
  "sections": [
    { "id": "timeline", "purpose": "Every status change of the claim, newest first" }
  ],
  "components": [
    { "section": "timeline", "element": "Status chip", "component": "Badge", "path": "apps/web/src/shared/ui/badge.tsx" },
    { "section": "timeline", "element": "Timeline row", "component": "new:TimelineItem", "path": "new" }
  ],
  "states": ["empty", "loading", "mobile"],
  "notes": "The approver's comment is collapsed past three lines."
}
```

| Field | Rule |
|---|---|
| `version` | `1`. |
| `title` | Short name of the screen or flow. |
| `issue` | The issue number, or `null` before there is one. |
| `designSource` | `DESIGN.md`, `theme-css` (tokens read from the theme stylesheet because `DESIGN.md` was missing) or `none`. |
| `sections` | One entry per `data-mockup-section` in the HTML, same ids, same order. |
| `components` | One entry per distinct `data-component` reference. `component` is the name the code uses; `path` is the reference from the HTML, or `new`. |
| `states` | The states the mockup draws, from `default`, `empty`, `loading`, `error`, `success`, `disabled`, `mobile`, or a domain state named in the issue. |
| `notes` | Optional. Behaviour the picture cannot show. |

## When the work is split

Each smaller issue covers some sections of the one mockup. Its body says which, on a line of its own: `Mockup sections: timeline, filters`, using the section ids. The refine workflow reads that line and links the issue to those sections.

## Where a published mockup lives

On the repository's `mockups` branch, an orphan branch that never merges into anything, at `issue-<number>/`. Every publish replaces that folder. Nothing on that branch is source code, and nothing in the source tree may import or copy from it.

The issue links it from a section the workflow writes between `<!-- agent-mockup:start -->` and `<!-- agent-mockup:end -->`, which opens with `<!-- agent-mockup: issue-<number> -->` naming the folder. A split child names its parent's folder there.
