## Agentmemory

- Cross-session context lives in the agentmemory MCP tools: `memory_smart_search` for prior decisions before working somewhere unfamiliar, `memory_save` for architecture decisions and anything the next agent will need, plus `memory_sessions` and `memory_governance_delete`.
- It is an MCP server, not a CLI. Never run `agentmemory` in bash; start it with `agentmemory` in a separate terminal and use the tools.
