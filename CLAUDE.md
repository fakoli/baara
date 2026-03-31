# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Baara ("work" in Bambara) — a delayed task execution system built on the Claude Agent SDK. Three interfaces (chat-first web UI, CLI, cron scheduler) share a single service layer backed by SQLite.

## Commands

```bash
bun start                              # Start server on 0.0.0.0:3000
bun run src/cli/index.ts tasks list    # CLI
bun run src/cli/index.ts logs          # View JSONL execution logs
bunx tsc --noEmit                      # Typecheck — must pass before committing
bunx playwright test                   # Run all 39+ Playwright tests
bunx playwright test tests/us4*        # Run a single test suite
make baara ARGS="tasks list"           # CLI via Makefile
```

## Runtime

- **Bun** (not Node). TypeScript with `.ts` imports: `import { x } from "./file.ts"`
- SQLite via **`bun:sqlite`** (NOT `better-sqlite3` — Bun doesn't support it)
- Frontend is vanilla JS in `web/` — no build step, no bundler

## Data Storage

```
~/.nexus/                    # Baara home (NEXUS_DIR env var)
├── baara.db                 # SQLite: tasks, jobs, queues, projects, templates
├── logs/execution.jsonl     # Append-only JSONL execution logs
├── sessions/                # Agent SDK session files
└── briefings/               # Morning briefing output
```

`~/.claude/` is read-only — only used to discover Claude Code plugins/commands via `src/integrations/claude-code.ts`.

## Architecture

```
src/index.ts          ← Entry point: creates Store → Services → Engine → Server
    │
    ├── db/store.ts   ← ALL database access. No direct queries elsewhere.
    │
    ├── services/     ← Business logic. Routes and CLI call these, never Store directly.
    │   ├── task-service.ts    (CRUD + input validation/sanitization)
    │   ├── job-service.ts     (submit, run, retry, cancel)
    │   └── template-service.ts
    │
    ├── engine/       ← Execution pipeline
    │   ├── dispatcher.ts      Task → Job routing (direct vs queued mode)
    │   ├── executor.ts        Runs Agent SDK query() or Bun.spawn() for raw_code
    │   ├── queue-manager.ts   Polls pending jobs, respects maxConcurrency
    │   ├── scheduler.ts       Croner cron registration
    │   └── health-monitor.ts  Flags slow/unresponsive jobs
    │
    ├── chat/         ← Agentic chat layer
    │   ├── tools.ts           17 MCP tools via tool() + createSdkMcpServer()
    │   ├── system-prompt.ts   Base prompt + buildSystemPrompt(context)
    │   └── context.ts         Injects live DB state per chat message
    │
    ├── server/       ← Hono HTTP server
    │   ├── app.ts             Middleware: CORS, CSP, auth, rate limiting
    │   └── routes/            chat.ts (SSE), tasks.ts, jobs.ts, projects.ts, system.ts
    │
    └── cli/          ← Commander CLI (baara tasks/jobs/logs/status)
```

### Execution Flow

```
Task → Dispatcher.dispatch(task)
  ├── direct mode:  create Job → execute → return completed Job
  └── queued mode:  create Job (pending) → QueueManager dequeues later
                                          ↓
                                    executor.executeJob()
                                      ├── agent_sdk: query() with tools
                                      ├── raw_code:  Bun.spawn(["sh","-c",prompt])
                                      └── wasm:      not yet implemented
                                          ↓
                                    Store.updateJobStatus() + jobLog() → JSONL
```

### Chat Architecture

`POST /api/chat` streams SSE via `streamSSE()` from `hono/streaming`. Each message:
1. Gathers live context (`gatherChatContext()` — task counts, triage, failures)
2. Builds dynamic system prompt with context
3. Calls Agent SDK `query()` with 17 in-process MCP tools
4. Streams `text_delta`, `tool_use`, `tool_result`, `result`, `done` events

Tools call service functions directly — no subprocess, no HTTP self-calls.

### Frontend State

`web/js/app.js` manages a single `state` object: `{ selectedTask, activeTab, contextView, panelCollapsed, activeProjectId }`. State changes trigger `renderAll()`. Context panel tabs: Overview | Tasks | Jobs | Queues | Logs.

## Key Types (`src/types.ts`)

- `ExecutionType`: `"agent_sdk" | "wasm" | "raw_code"`
- `ExecutionMode`: `"queued" | "direct"` — direct is default, skips queue
- `Priority`: `0` (critical) through `3` (low), FIFO within tier
- `JobStatus`: `"pending" | "running" | "completed" | "failed" | "triage" | "timed_out" | "cancelled"`
- `Task.agentConfig`: JSON blob with `allowedTools`, `model`, `systemPrompt`, `mcpServers`, `maxTurns`, `maxBudgetUsd`, `permissionMode`

## Patterns

**Store access**: All DB queries go through `src/db/store.ts` methods. Services call Store. Routes call Services. Never skip layers.

**Input validation**: `TaskService.sanitizeInput()` clamps timeoutMs (1s–1hr), maxRetries (0–10), maxBudgetUsd (default $2, max $10). Validates executionType and permissionMode against allowlists.

**HTML escaping**: `escapeHtml()` from `web/js/utils.js` **must** be used on ALL user data in innerHTML templates. Includes single-quote escaping.

**Adding a tool**: Define in `src/chat/tools.ts` using `tool()`, add to `createBaaraTools()` array. Auto-available as `mcp__baara__<name>`.

**Adding a route**: Create `src/server/routes/foo.ts`, export `fooRoutes(deps)`, mount in `app.ts` via `app.route("/api/foo", fooRoutes(deps))`.

**Logging**: Use `log()` for system events, `jobLog()` for per-job execution events (writes to JSONL).

## Security

- `BAARA_API_KEY` env var — if set, all `/api/*` routes require `X-Api-Key` header
- CORS: exact `Set.has()` origin matching (no substring `.includes()`)
- CSP: `script-src 'self'`, no inline scripts
- Rate limit: 10 run/submit/chat calls per minute per IP
- `raw_code` runs `sh -c <prompt>` — privileged, requires API auth
- Crash recovery: orphaned "running" jobs reset to "failed" on startup
- Graceful shutdown: SIGINT/SIGTERM → stop scheduler/queue/monitor → WAL checkpoint → close DB

## Auth Modes

```bash
BAARA_AUTH_MODE=subscription   # Default: Claude subscription via CLI (free within limits)
BAARA_AUTH_MODE=api_key        # Uses ANTHROPIC_API_KEY (per-token billing)
```

## v1.3.0 Features

- **Task creation wizard** (3-step): Basics -> Execution -> Schedule & Tools. Replaces the single-modal flow.
- **Plan mode**: Toggle in chat input prepends planning instructions so Claude presents a numbered plan before executing.
- **System prompt settings**: Configurable system prompt saved in SQLite settings table, merged into chat context.
- **Tool selection per-task**: Checkboxes on wizard step 3 let users pick which tools (WebSearch, Bash, etc.) a task may use.
- **Cron presets**: Dropdown with common schedules + human-readable preview for custom expressions.
- **Slash command autocomplete**: Tab-completion in chat input from discovered Claude Code plugins.
- **Isolation level dropdown**: Future-ready UI for Docker/Wasm sandboxing.

## Before Committing

1. `bunx tsc --noEmit` — zero errors
2. `bunx playwright test` — all tests pass
3. `bun start` — boots without error
