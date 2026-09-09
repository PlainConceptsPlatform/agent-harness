## CodeGraph

- `codegraph_explore` replaces grep, glob and read for anything indexed: one call returns the relevant symbols' verbatim, line-numbered source plus the call paths between them, where finding the same thing by hand takes a dozen. Give it a symbol name, a file path, or a plain question.
- Fall back to grep, glob and read when it returns nothing, or for what it does not index: config files, plain-text docs, `.env` patterns, raw string searches. Say that it returned nothing when you do.
- It is an MCP server, not a CLI. Never run `codegraph` in bash.
