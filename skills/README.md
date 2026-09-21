# skills/

Two kinds of skills live here, both discoverable by `npx skills`:

| Kind | Directories | Purpose |
| --- | --- | --- |
| Installable `pc-*` + `browser-automation` | `pc-*`, `browser-automation` | What the CLI copies into a target project under `.agents/skills/` during onboarding. Plain Concepts' own skills. |
| CLI-self | `agent-harness-cli` | Skills for agents working on THIS CLI repo (driving `npx @plainconceptsplatform/agent-harness`). Never copied into target projects. |

Discoverability: any `SKILL.md` in a subdirectory here is auto-discovered by OpenCode, Claude Code, and `npx skills` (which scans `./skills/` as a recognized project-skill location).

## Using one

Point your agent at the directory, or copy a skill into wherever your tool discovers skills:

```bash
cp -r skills/agent-harness-cli ~/.claude/skills/
```
