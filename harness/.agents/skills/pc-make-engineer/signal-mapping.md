# Signal-to-query mapping

Every uncovered signal gets its own search.

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

A signal that fits no row derives its query from its own value: `npx skills find "<signal-value>"`.

## Known direct sources (architecture and patterns)

These live in dedicated repos and install by `owner/repo`, so `npx skills find` never surfaces them. They are the option list for the architecture question, and the source for it when the user picks one.

| Selection | Install command | Skill(s) to pick |
|---|---|---|
| Feature-Sliced Design (FSD) | `npx skills add -y feature-sliced/skills` | `feature-sliced-design` |
| Design patterns | `npx skills add -y PatternsDev/skills --skill <name>` | `hooks-pattern`, `hoc-pattern`, `compound-pattern`, `render-props-pattern`, `provider-pattern`, `observer-pattern`, `factory-pattern`, `module-pattern` |
| Rendering patterns | `npx skills add -y PatternsDev/skills --skill <name>` | `server-side-rendering`, `client-side-rendering`, `static-rendering`, `streaming-ssr`, `react-server-components`, `progressive-hydration`, `islands-architecture` |
| Performance patterns | `npx skills add -y PatternsDev/skills --skill <name>` | `bundle-splitting`, `tree-shaking`, `dynamic-import`, `route-based`, `js-performance-patterns`, `react-render-optimization` |
| Modern React (2026 stack) | `npx skills add -y PatternsDev/skills --skill <name>` | `react-2026`, `react-composition-2026`, `react-data-fetching` |
| Microservices, monolith / layered | `npx skills find "<pattern-name> architecture"` | best result per the quality filter |

Take only what the persona and the user's selection call for, at most two or three patterns.dev picks (full catalog: https://www.patterns.dev/ai/skills/catalog/). These sources are curated, so the install-count filter does not apply to them.

## Quality filter

From each search result, in order:

1. Install count at least 100, preferably 1000. Below 100, record "no quality skill found on skills.sh for \<signal\>" and move on.
2. Prefer an official or canonical source (`vercel-labs`, `anthropics`, `microsoft`, `feature-sliced`, `wshobson`, `github`) over an unknown author.
3. The description has to match the signal. A React skill with 500K installs does not cover TypeScript.
4. No redundancy: skip a candidate whose scope an already-selected skill covers, unless it goes genuinely deeper on a different concern.

One skill per detected signal is the floor, five to eight is the usual range, ten is the cap: past that, rank by install count and source and keep the top ten. Fewer than five found is worth saying out loud, since the user can add more in the confirmation form.

## Verifying an install

`npx skills add` is not proof of anything. Read back both `.agents/skills/<skill-name>/SKILL.md` and `skills-lock.json`.

- Skill present, lockfile entry missing: add the entry with the Edit tool, matching the existing keys' naming, as `"source": "<owner/repo>", "sourceType": "github", "skillPath": "skills/<skill-name>/SKILL.md", "computedHash": "<skill-name>-placeholder"`, then re-read the file to confirm it is still valid JSON.
- Skill missing: retry once, then drop it from the set and report the failure.
