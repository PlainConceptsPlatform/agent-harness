# AGENTS.md

## Project overview

agent-harness is a Node.js CLI tool that prepares any codebase for AI agent workflows. It wires OpenCode, OpenSpec, codegraph, and agentmemory into a multi-agent development system via an interactive wizard. The CLI copies template files (skills, commands, agent configs) into a target project and patches them based on the user's chosen platforms (GitHub, Azure DevOps, Jira, GitLab, browser).

Key technologies: Node.js 18+, ESM (`"type": "module"`), pnpm, Vitest, ESLint flat config. No TypeScript, no build step, no bundler.

## Architecture

```
src/
  index.js                    CLI entry point, dispatches to commands
  commands/                   CLI commands (wizard, single, join, update)
  steps/                      Wizard steps (copy, platform, models, openspec, browser, clean, metadata, optimization, source)
  presets/                    JSON/MD data files that parameterize steps (platforms, models, skills, source, etc.)
  utils/                      Shared utilities (copy, exec, process, terminal, models-cache, models-pricing)
  content/                    Template files copied into target projects during onboarding
    .agents/skills/           pc-* skills shipped with the CLI (plan-goal, make-engineer, repo-initialize, etc.)
    .opencode/commands/       Slash command thin wrappers that load skills
    .opencode/                opencode.json, tui plugins, opencode config
    .opencode/plugins/        Server-side plugins (subagent monitor, tiers, system reminders)
    AGENTS.md                 Template AGENTS.md installed into target projects
    ARCHITECTURE.md            Template architecture doc
    DESIGN.md                 Template design doc
docs/                         Landing page (static HTML/CSS/JS), deployed via GitHub Pages
```

The core pattern: `src/content/.opencode/commands/*.md` are thin wrappers (just "Load the `pc-*` skill and follow every step defined in it."). The actual procedure lives in `src/content/.agents/skills/pc-*/SKILL.md`. This makes commands composable since any agent can load a skill mid-conversation.

The copy step (`src/steps/copy/index.js`) resolves `CONTENT_DIR` relative to the source file, copies it to the target project, then patches files in-place based on platform selection (e.g., injecting gh/az/jira/glab CLI commands into skills and AGENTS.md).

## Setup

```bash
pnpm install
```

## Development commands

```bash
pnpm lint          # Run ESLint
pnpm lint:fix      # Auto-fix lint issues
pnpm test          # Run all tests (vitest run)
pnpm test:watch    # Watch mode
```

There is no dev server or build step. The CLI runs directly via `node src/index.js` or `npx @plainconceptsplatform/agent-harness`.

## Testing

Tests use Vitest with the Node environment. Test files live alongside their source (`*.test.js`) or in `__tests__/` directories.

- Run all tests: `pnpm test`
- Run a single file: `npx vitest run src/steps/copy/integration.test.js`
- Watch mode: `pnpm test:watch`

Integration tests in `src/steps/copy/integration.test.js` run patchers against the real template files in `src/content/`. They catch drift between `src/` code and `src/content/` templates (heading renames, skill gating, double-escaped preset strings). If you change a template's structure, these tests will fail until you update the patcher or assertions.

Tests mock `execa` and `../../utils/exec.js` to avoid real shell commands. The `process.cwd()` is spied to a temp directory in integration tests.

## Code style

- ESM only (`import`/`export`, no `require`)
- Double quotes for strings in JS, single quotes inside JSON preset files
- ESLint flat config with strict rules: `prefer-const`, `eqeqeq`, `prefer-template`, `object-shorthand`, `no-unused-vars` (with `^_` ignore pattern for unused args)
- Path resolution: source files use `path.resolve(__dirname, '../../content')` to find the content directory relative to the file, not `process.cwd()`. This matters because the package is consumed via `npx`, so the content ships inside `src/content/`
- No comments in code unless there is a non-obvious reason worth documenting

## Key patterns

### Path resolution

Source files in `src/steps/copy/` resolve `CONTENT_DIR` via `path.resolve(__dirname, '../../content')` (two levels up from `src/steps/copy/`). When you move files, update the relative path depth.

### Template patching

Patchers (`agents.js`, `commands.js`, `skills.js`) read template files from `src/content/`, modify them based on platform, and write to the target project. The integration tests verify these patchers against real templates. Markers like `<!-- PC-PLATFORM-WORKFLOW-START -->` / `<!-- PC-PLATFORM-WORKFLOW-END -->` are used for safe string replacement.

### Skill loading

Skills live in `.agents/skills/pc-*/SKILL.md` with YAML frontmatter (`name`, `description`, `license`). Commands in `.opencode/commands/*.md` are thin wrappers that say "Load the `pc-*` skill and follow every step defined in it." To convert a command to a skill, move the body to a SKILL.md, add frontmatter, and replace the command with the wrapper line.

## Project-specific notes

- `.agents/skills/` at the repo root contains skills for working on THIS repo (caveman, create-agentsmd, humanizer, writing-great-skills). These are development tools, not part of the CLI content shipped to users. Do not confuse them with `src/content/.agents/skills/` which are the template skills shipped by the CLI.
- `src/content/.opencode/node_modules/` and `src/content/.opencode/package-lock.json` exist because the content templates include their own package.json for the TUI plugins. These are gitignored and excluded from ESLint.
- The `files` field in `package.json` controls what ships to npm: `src` (excluding tests and `__tests__`) and `src/content` (excluding node_modules).

## PR instructions

- Run `pnpm lint` and `pnpm test` before committing. Both must pass.
- No commit message format requirement, but keep it descriptive.
- The `prepublishOnly` script runs lint and tests before npm publish, so a failing CI will block releases.
