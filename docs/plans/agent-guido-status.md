---
Status: COMPLETE
---
# Guido Decisions
- createBaaraTools() accepts service deps (taskService, jobService, templateService, store), returns McpSdkServerConfigWithInstance
- chatRoutes() accepts the MCP server, mounts as POST handler with SSE streaming
- SSE event format: { type, content/name/input/output/text/usage/isError/costUsd/durationMs }
- Event types: system, text, text_delta, tool_use, tool_result, result, error, done
- Tool resolution: nameOrId params resolve via getTaskByName() ?? getTask()
- bypassPermissions + allowDangerouslySkipPermissions set for chat; tools=[] disables built-in tools, only MCP tools available
- Files created: src/chat/tools.ts, src/chat/system-prompt.ts, src/server/routes/chat.ts
- Files modified: src/config.ts (added authMode: "subscription" | "api_key")
