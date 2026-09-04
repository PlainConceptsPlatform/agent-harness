## CodeGraph

- **Use `codegraph_explore` INSTEAD OF grep, glob, or read.** It is always available. Do not assume it might be missing.
  - One call returns the relevant symbols' verbatim, line-numbered source plus the call paths between them, use it as a full replacement for Read, Grep, and file-reading sub-tasks when working with indexed code.
  - If you instinctively reach for grep or read to find or understand code, STOP: call `codegraph_explore` instead with the symbol name, file path, or a natural-language question. It covers the same ground in one call instead of a dozen.
- **Fall back to grep/glob/read ONLY when `codegraph_explore` returns no results** or the query is for something codegraph does not index (config files, plain-text docs, `.env` patterns, raw string searches). When you do fall back, you MUST state that codegraph returned nothing.
- Do NOT run `codegraph` in bash: it is an MCP server, not a CLI tool.
