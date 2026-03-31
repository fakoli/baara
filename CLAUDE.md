# Baara — Claude Code Conventions

## Project
Baara ("work" in Bambara) — a delayed task execution system built on the Claude Agent SDK.

## Runtime
- **Bun** (not Node). Run with `bun run src/index.ts` or `bun start`.
- TypeScript files use `.ts` extension with `import ... from "./file.ts"` paths.
- SQLite via `bun:sqlite` (NOT `better-sqlite3` — Bun doesn't support it).

## Data Paths
- **Home directory:** `~/.nexus/` (set via `NEXUS_DIR` env var)
- **Database:** `~/.nexus/baara.db` (SQLite, via bun:sqlite)
- **Execution logs:** `~/.nexus/logs/execution.jsonl` (append-only JSONL)

## Key Commands
```bash
bun start                          # Start server (0.0.0.0:3000)
bun run baara tasks list           # CLI
bun run baara logs                 # View execution logs (JSONL)
bun run baara logs --level error   # Filter logs by level
bunx tsc --noEmit                  # Typecheck (run before committing)
make baara ARGS="tasks list"       # Alternative CLI via Makefile
```

## Architecture
- `src/db/` — SQLite schema + Store (all DB access)
- `src/engine/` — Dispatcher, QueueManager, Executor, Scheduler, HealthMonitor
- `src/services/` — TaskService, JobService, TemplateService (business logic)
- `src/server/` — Hono API routes with auth + rate limiting + CSP
- `src/chat/` — Claude-powered agentic chat (tools, system prompt, SSE endpoint)
- `src/cli/` — Commander-based CLI (`baara` command, includes `baara logs`)
- `src/integrations/` — Claude Code plugin/command discovery from ~/.claude/
- `web/` — Vanilla JS frontend (no build step)

## API Endpoints (key additions in v1.2)
- `GET /api/logs` — System-wide execution logs (query params: `limit`, `level`, `jobId`, `taskName`)
- `GET /api/jobs/:id/logs` — Per-job execution logs from JSONL

## UI Components (v1.2)
- **LOGS tab** in context panel — shows execution log entries with level filters (All/Info/Warn/Error)
- **Create Task modal** — includes Queue dropdown (`#modal-queue`) and "Create & Run Now" button (`.run-now-btn`)

## Chat Architecture
- `src/chat/tools.ts` — 17 Baara tools via Agent SDK tool() + createSdkMcpServer()
- `src/chat/system-prompt.ts` — System prompt for chat Claude
- `src/server/routes/chat.ts` — POST /api/chat SSE endpoint
- Chat uses `streamSSE()` from `hono/streaming`
- Tools call services in-process (no subprocess, no HTTP self-calls)

## Auth Modes
- `BAARA_AUTH_MODE=subscription` (default) — uses Claude subscription via CLI
- `BAARA_AUTH_MODE=api_key` — uses ANTHROPIC_API_KEY, billed per token

## Adding a New Tool
1. Add tool definition in `src/chat/tools.ts` using `tool()` from Agent SDK
2. Add it to the tools array in `createBaaraTools()`
3. The tool is automatically available in the chat and named `mcp__baara__<tool_name>`

## Security
- API auth via `BAARA_API_KEY` env var (optional — if set, all /api/* routes require it)
- CORS exact origin allowlist (no `.includes()` substring matching)
- CSP + X-Frame-Options: DENY + X-Content-Type-Options: nosniff headers
- Rate limit: 10 run/submit calls per minute per IP
- Input validation: timeoutMs clamped to 1hr max, maxRetries to 10, maxBudgetUsd to $10
- `raw_code` execution type runs arbitrary shell — privileged, requires API auth
- See `docs/security/review-2026-03-31.md` for full security review

## Conventions
- Server binds `0.0.0.0` for cross-machine access (Mac mini → laptop)
- All interfaces (Web, CLI, Cron) call the same service functions — no duplicated logic
- `executionMode: "direct"` is the default (bypasses queue, immediate execution)
- `escapeHtml()` must be used on ALL user-facing data in `web/js/` innerHTML templates

## Before Committing
1. `bunx tsc --noEmit` — zero errors
2. `grep -r "fakoli" src/ web/ package.json` — should return only hostname refs (Fakoli-Mini.local)
3. Test: `bun start` boots without error
