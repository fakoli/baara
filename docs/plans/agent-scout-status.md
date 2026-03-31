---
Status: COMPLETE
---
# Scout Findings

- Use `streamSSE()` from `hono/streaming` for POST /api/chat (auto-sets Content-Type)
- Use `includePartialMessages: true` in query() for real-time token streaming
- Use `tool()` + `createSdkMcpServer()` for in-process custom tools
- Browser must use fetch + ReadableStream (not EventSource) because endpoint is POST
- Tool naming: `mcp__{serverName}__{toolName}` double-underscore convention
- `inputSchema` takes Zod raw shape `{ query: z.string() }`, NOT `z.object()`
- `streamSSE` writeSSE data must be a string — JSON.stringify() objects
- `allowedTools` auto-approves but does NOT restrict — use `disallowedTools` to block
- Current executor.ts passes `abortSignal` but SDK uses `abortController` — needs fix
