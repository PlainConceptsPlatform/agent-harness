---
name: pc-make-user-model
description: Set the model for a tier (plan, build, or fast). Team-wide or user-local override. Invoked by the /make-user-model command.
license: MIT
---
Set the concrete model for one tier. Writes to `models` in either the team config (shared, git-tracked) or a user-local override (gitignored).

Usage:

```
/make-user-model <tier> <model>
/make-user-model user <tier> <model>
```

- `user`: optional prefix. If present, writes to `.opencode/harness.user.json` (gitignored, overrides team config for this machine only). If absent, writes to `.opencode/harness.json` (shared with the team).
- `<tier>`: one of `plan`, `build`, `fast`.
- `<model>`: a fully-qualified model id (e.g. `opencode/big-pickle`) OR the keyword `current` to use the model active in this session.

Arguments: `$ARGUMENTS`

Steps

1. Parse `$ARGUMENTS`** by whitespace.
   - If first token is `user`: `isUser = true`, `<tier>` = second token, `<model>` = third token.
   - Otherwise: `isUser = false`, `<tier>` = first token, `<model>` = second token.
   - If `$ARGUMENTS` is empty: read both `.opencode/harness.json` and `.opencode/harness.user.json` and show the current `models` from each (team first, user override second), then show the usage above. Change nothing.
   - If `<tier>` is not exactly one of `plan` / `build` / `fast`, or `<model>` is missing: print the usage and stop. Change nothing.

2. **Resolve `<model>`:**
   - If it is the literal `current`: use the model id visible in the opencode status line for this session. Use only the model id shown there, not a guessed value.
   - Otherwise use the value verbatim. It must look like `provider/model-id`. If it contains no `/`, warn that it looks malformed and call the `question` tool to confirm before writing:

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

     Only proceed to write if the user answers `yes`.

3. Determine target file.
   - `isUser = false` -> `.opencode/harness.json` (team). If it does not exist, stop and tell the user onboarding has not generated it yet.
   - `isUser = true` -> `.opencode/harness.user.json` (user override). If it does not exist, create it with `{ "models": {} }`.

4. Update the config. Read the target file, set `models.<tier>` to the resolved model id (create `models` if absent). Do not touch any other field. Preserve the existing 2-space JSON formatting, then write the file back.

5. Confirm:

   ```
   <team|user> config updated
     <tier> model -> <resolved-id>
     file: <path written>
   ```

   Restart opencode for the change to take effect. The `pc-subagent-tiers` plugin reads the model configs at startup and injects tier-suffixed agent variants (`<engineer>.<tier>`) into the live config. After restart, `/plan-apply` will spawn agents on the new model.

This command edits `harness.json` (team) or `harness.user.json` (user) only. It never modifies agent files, `opencode.json`, or `tasks.md`. Tier variants are generated in-memory by the `pc-subagent-tiers` plugin at startup: no file re-stamping needed.
