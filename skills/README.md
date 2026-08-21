# skills/

Skills **about** this CLI, for any AI agent that has to operate it.

These are not the skills the CLI installs. Those live in
[`src/content/.agents/skills/`](../src/content/.agents/skills) under the `pc-`
prefix and are copied into a target repository during install. The skills here
never ship inside the npm package — they document the CLI itself.

| Skill | Use it when |
| --- | --- |
| [`agent-harness-cli`](agent-harness-cli/SKILL.md) | Installing the harness into a repo, updating an existing one, setting up a teammate's machine, or diagnosing a failed run |

## Using one

Point your agent at the directory, or copy a skill into wherever your tool
discovers skills:

```bash
cp -r skills/agent-harness-cli ~/.claude/skills/
```

Any `SKILL.md` in a subdirectory is discoverable by OpenCode and Claude Code
alike, so no registration step is needed.
