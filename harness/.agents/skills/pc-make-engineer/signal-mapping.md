# Signal-to-query mapping

For each uncovered signal, run a mandatory `npx skills find` with a specific query. Every uncovered signal gets its own search. No signal is skipped. Capture the output of each search.

| Signal type | Search query |
|---|---|
| Language | `npx skills find "<language-name>"` (e.g. `typescript`, `csharp`, `python`) |
| Framework | `npx skills find "<framework-name>"` (e.g. `react`, `ink`, `angular`, `django`) |
| Architecture | Use the known direct sources below. Optionally also `npx skills find "<pattern-name>"` |
| Testing | `npx skills find "<test-framework> testing"` (e.g. `vitest testing`, `jest testing`) |
| Styling | `npx skills find "<css-framework>"` (e.g. `tailwind`, `css modules`, `design tokens`) |
| Linting | `npx skills find "eslint prettier"` or `"lint format"` |
| CI/CD | `npx skills find "ci cd pipeline"` or `"<platform> actions"` |
| Cloud / IaC | `npx skills find "<cloud-provider> infrastructure"` (e.g. `azure infrastructure`) |
| Monitoring | `npx skills find "observability monitoring"` |
| i18n | `npx skills find "i18n internationalization"` |
| Data layer | `npx skills find "<orm-or-db> orm"` (e.g. `entity framework orm`, `prisma orm`) |
| Dependency Injection | `npx skills find "<di-framework>"` (e.g. `inversify`, `autofac`) |

If a signal doesn't fit any table row, derive a query from the signal value itself: `npx skills find "<signal-value>"`.

## Known direct sources (architecture and patterns)

Some high-value skills live in dedicated repos and install by direct `owner/repo` reference, so `npx skills find` never surfaces them. When the persona is `frontend` / `backend` / `layout` / `api`, or the user selected an architecture/pattern in Step 3, pull from this table:

| Selection (Step 3) | Install command | Skill(s) to pick |
|---|---|---|
| Feature-Sliced Design (FSD) | `npx skills add -y feature-sliced/skills` | `feature-sliced-design` |
| Design patterns | `npx skills add -y PatternsDev/skills --skill <name>` | `hooks-pattern`, `hoc-pattern`, `compound-pattern`, `render-props-pattern`, `provider-pattern`, `observer-pattern`, `factory-pattern`, `module-pattern` |
| Rendering patterns | `npx skills add -y PatternsDev/skills --skill <name>` | `server-side-rendering`, `client-side-rendering`, `static-rendering`, `streaming-ssr`, `react-server-components`, `progressive-hydration`, `islands-architecture` |
| Performance patterns | `npx skills add -y PatternsDev/skills --skill <name>` | `bundle-splitting`, `tree-shaking`, `dynamic-import`, `route-based`, `js-performance-patterns`, `react-render-optimization` |
| Modern React (2026 stack) | `npx skills add -y PatternsDev/skills --skill <name>` | `react-2026`, `react-composition-2026`, `react-data-fetching` |

Rules for this table:
- Pick only skills relevant to the persona and the user's Step 3 selections.
- Cap patterns.dev picks at 2-3 of the most relevant. Full catalog: https://www.patterns.dev/ai/skills/catalog/
- These sources are curated and canonical, so they are exempt from the install-count filter below.
- Add the resolved skills to the recommended set. They are installed only after the user confirms.

## Quality filter

From each search result, select the best candidate using these rules in order:

1. Install count at least 100. Skip anything below. Prefer at least 1000.
2. Official or canonical source. Prefer `vercel-labs`, `anthropics`, `microsoft`, `feature-sliced`, `wshobson`, `github` over unknown authors.
3. Topical match. The skill description must clearly match the signal. A React skill with 500K installs doesn't cover TypeScript if its description is only about React components.
4. If the top result is below 100 installs, record "no quality skill found on skills.sh for \<signal\>" and move on.

## Assembling the recommended set

Combine the winners from the `npx skills find` searches and the known direct sources into a single recommended set:

- Minimum = number of detected persona-relevant signals (if 6 signals detected, aim for at least 6 skills, one per signal minimum)
- Ideal range: 5-8 for most engineers
- Hard cap: 10. If more candidates found, rank by install count and source reputation and keep the top 10.
- No redundant skills. If an already-selected skill covers the same scope as a new candidate (e.g. `vercel-react-best-practices` already covers TypeScript basics), skip the new candidate unless it provides genuinely deeper coverage for a different concern.
- If fewer than 5 skills are found after all searches, note it. The user can still add more in the confirmation form.

## Post-install verification

After each `npx skills add`, verify the skill actually landed and tracked itself in the lockfile:

1. Check `.agents/skills/<skill-name>/SKILL.md` exists
2. Check `skills-lock.json` now contains the skill entry (read it back, do not assume the entry was written)

If `.agents/skills/<skill-name>/SKILL.md` exists but `skills-lock.json` does not contain the entry: manually patch the lockfile using the Edit tool. Open `skills-lock.json`, add a new entry inside the `"skills"` object using the `owner/repo` from the install command and the structure `"source": "<owner/repo>", "sourceType": "github", "skillPath": "skills/<skill-name>/SKILL.md", "computedHash": "<skill-name>-placeholder"`. Match the existing entries' key naming. Re-read `skills-lock.json` to confirm the entry is valid JSON.

If `.agents/skills/<skill-name>/SKILL.md` is missing (network glitch, wrong repo name, auth issue): retry the install once. If still failing, drop the skill from the selection and note it in the summary as "install failed".
