---
name: pc-make-user-model
description: Set the model for a tier (plan, build, or fast). Team-wide or user-local override. Invoked by the /make-user-model command.
license: MIT
---

Point one tier at one model, in the team config or in a machine-local override.

## Rules

- Only `models.<tier>` in `.opencode/harness.json` or `.opencode/harness.user.json` changes. Agent files, `opencode.jsonc` and `tasks.md` are not this command's business, and tier variants are rebuilt from these configs at startup anyway.
- Never guess the id behind `current`: read it from the status line. A guessed id writes a model that does not exist into the team's config.
- Never write anything when the arguments do not parse. Print the usage and stop.
- Preserve the file's other fields and its 2-space formatting.

## Contract

```
/make-user-model <tier> <model>
/make-user-model user <tier> <model>
```

`user` writes `.opencode/harness.user.json`, which is gitignored and wins on this machine only; without it the target is `.opencode/harness.json`, which is shared. `<tier>` is exactly `plan`, `build` or `fast`. `<model>` is a fully-qualified id (`opencode/big-pickle`) or `current` for the model this session is running.

No arguments means show the `models` block from both files, team first, then the usage. Change nothing.

A team config that does not exist yet is a stop: onboarding has not run. A missing user config is created as `{ "models": {} }`.

An id with no `/` in it is malformed; confirm before writing it:

```json
{
  "questions": [
    {
      "header": "Malformed model id",
      "question": "\"<model>\" doesn't look like a valid model id (expected provider/model-id). Write it anyway?",
      "options": [
        { "label": "yes", "description": "Write the value as-is to the config file." },
        { "label": "no", "description": "Cancel. Do not write anything." }
      ]
    }
  ]
}
```

## Report

```
<team|user> config updated
  <tier> model -> <resolved-id>
  file: <path written>
```

The change lands on the next opencode start, when `pc-subagent-tiers` reads the configs and rebuilds the tier variants.

Arguments: `$ARGUMENTS`
