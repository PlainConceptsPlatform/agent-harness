# Task annotation reference

## Tier selection

Pick a tier for each task based on complexity:
- `build`: complex code: data models, APIs, auth logic, core business logic, UI components
- `fast`: light work: i18n keys, config changes, env variables, navigation links, simple markup, verification runs
- `plan`: reserved for orchestration, do not use for implementation tasks

The tier suffix is appended to the agent name with a dot (e.g. `backend-engineer.build`). This is the agent name you write in the annotation. The `pc-subagent-tiers` plugin resolves the model at startup from `models[<tier>]`.

## depends_on

Derive `depends_on` for each task: the OpenSpec task IDs (`N.M`) it logically needs completed first (a task that consumes another's output: UI needs its RPC, tests need the code, a seed needs its migration). Root tasks get `[]`. Reference the IDs OpenSpec already generated. Never invent new ones.

## touches

Derive `touches` for each task: the file path(s)/glob(s) it will create or modify (the task text usually names them, e.g. "Modify src/board/components/CreateForm.tsx"). This lets `pc-plan-apply` serialize same-file tasks that have no logical dependency. Include net-new files.

## Annotation format

Annotate each task line in-place with all three fields:

```
- [ ] <task text> <!-- agent: <name>, depends_on: [<ids>], touches: [<globs>] -->
```

Example result (note same-file tasks like 1.1/1.2 share `touches`, so `pc-plan-apply` runs them sequentially even with no `depends_on` between them; tier suffix encodes the model):

```
- [ ] 1.1 Add Project model to schema <!-- agent: backend-engineer.build, depends_on: [], touches: [src/types.ts] -->
- [ ] 1.2 Add projectId field to LoopOptions <!-- agent: backend-engineer.build, depends_on: [], touches: [src/types.ts] -->
- [ ] 2.1 Project RPC endpoints <!-- agent: backend-engineer.build, depends_on: [1.1], touches: [src/rpc/project/**] -->
- [ ] 3.1 Accept page UI <!-- agent: frontend-engineer.build, depends_on: [2.1], touches: [src/board/components/CreateForm.tsx] -->
- [ ] 3.2 i18n keys for invitation flow <!-- agent: frontend-engineer.fast, depends_on: [3.1], touches: [src/i18n/**] -->
- [ ] 4.1 Run typecheck and fix errors <!-- agent: backend-engineer.fast, depends_on: [2.1,3.1], touches: [] -->
```

`pc-plan-apply` reads these annotations to build conflict-free waves: `depends_on` gates ordering, `touches` keeps concurrent agents file-disjoint, and the tier suffix in `agent` determines the model (resolved at startup by the `pc-subagent-tiers` plugin). `depends_on` is mandatory; `touches` is a best-effort hint.
