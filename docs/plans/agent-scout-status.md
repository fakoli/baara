---
Status: COMPLETE
---

# Scout Research — Key Findings Summary

## Agent SDK Patterns
- `query()` returns AsyncGenerator<SDKMessage> — iterate with `for await`
- Result in `message.type === "result"` with `.result`, `.total_cost_usd`, `.usage`
- Usage per turn: `message.type === "assistant"` → `message.message.usage.input_tokens`
- Permission: `permissionMode: "bypassPermissions"` for automated tasks
- MCP: pass `mcpServers: { name: { command, args, env } }` in options
- No built-in timeout — use AbortController externally

## Hono + Bun
- `export default app` or `export default { port, fetch: app.fetch }`
- Route groups: `const api = new Hono(); app.route('/api', api)`
- Static files: `import { serveStatic } from 'hono/bun'`
- CORS: `import { cors } from 'hono/cors'`
- Error handling: `app.onError((err, c) => ...)`

## bun:sqlite
- `import { Database } from "bun:sqlite"` — no external dep
- `.query().get()`, `.query().all()`, `.query().run()`
- Transactions: `db.transaction((args) => { ... })`
- Atomic dequeue: `UPDATE ... WHERE id = (SELECT id ... ORDER BY priority ASC, created_at ASC LIMIT 1)`

## Croner
- `new Cron('*/5 * * * *', async () => { ... })`
- Stop: `job.stop()` — supports async callbacks
- Bun >=1.0 compatible, zero deps

## Dispatcher
- Queued: create Job → enqueue → worker dequeues
- Direct: create Job → execute immediately → return result
- Atomic dequeue via UPDATE with subquery (no race conditions in SQLite)

## Health Monitoring
- setInterval heartbeat updating `health_status` + `last_heartbeat`
- Threshold: `slow` at >50% timeout, `unresponsive` at no heartbeat in 30s
