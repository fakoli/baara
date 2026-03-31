# Baara

> *"Baara"* means "work" in Bambara/Mandinka.

An agentic, chat-first task execution system built on the Claude Agent SDK. Talk to Claude in natural language to create, run, and manage tasks -- or use the CLI and cron scheduler. Priority queues, failure triage, and at-least-once delivery semantics. Runs as a single binary on a Mac mini.

```
┌──────────────────────────────────────────────────────────┐
│                        Baara                             │
│                                                          │
│  ┌─────────────────────┐  ┌─────────────────────────┐   │
│  │  Chat (Claude AI)    │  │  Context Panel          │   │
│  │  Natural language    │  │  (collapsible)          │   │
│  │  task management     │  │                         │   │
│  │                      │  │  Tasks / Jobs / Queues  │   │
│  │  "Create a task..."  │  │  Auto-updates on tool   │   │
│  │  ⚡ create_task      │  │  calls                  │   │
│  │  ✓ Created!          │  │                         │   │
│  └─────────────────────┘  └─────────────────────────┘   │
│                                                          │
│  14 Baara Tools (MCP) ──► Services ──► SQLite            │
│  CLI (baara) ────────────►                               │
│  Cron Scheduler ─────────►                               │
└──────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install
bun install

# Configure
cp .env.example .env
# Default: subscription mode (uses Claude CLI, no API key needed)
# Optional: set BAARA_AUTH_MODE=api_key and add ANTHROPIC_API_KEY

# Start server (http://0.0.0.0:3000)
bun start

# Or use the CLI
bun run src/cli/index.ts tasks list
bun run src/cli/index.ts status
```

## Features

- **Chat-first UI** — Claude-powered agentic chat. Describe what you want in natural language and Claude calls Baara tools to make it happen.
- **14 custom tools** — Exposed via in-process MCP server (create_task, run_task, list_jobs, etc.). Claude picks the right tool for every request.
- **SSE streaming** — Real-time streamed responses from Claude, including tool use and results.
- **Dual auth modes** — Use your Claude subscription (free within limits) or an API key (per-token billing).
- **Collapsible context panel** — Chat is the primary interface; tasks, jobs, queues, and logs live in a collapsible side panel that auto-updates on tool calls.
- **Multi-step task creation wizard** — 3-step wizard (Basics, Execution, Schedule & Tools) with queue selection, cron presets, and "Create & Run Now" option.
- **Plan mode** — Toggle plan mode in chat for structured execution planning. Claude presents a numbered plan before taking action.
- **Configurable system prompt** — Custom system prompt saved in settings, merged into every chat context.
- **Per-task tool selection** — Choose which tools (WebSearch, Bash, Read, Write, etc.) each task is allowed to use.
- **JSONL execution logging** — Every task execution is logged to `~/.nexus/logs/execution.jsonl` with level, timestamp, task name, and job ID. Viewable in the LOGS tab, via API, or CLI (`baara logs`).
- **Priority queues** — P0 (critical) through P3 (background) with FIFO tie-breaking.
- **Dual execution modes** — Queued (full pipeline) or Direct (immediate, ideal for Mac mini).
- **Agent SDK integration** — Built-in tools (WebSearch, WebFetch, Bash), MCP servers, subagents.
- **Failure triage** — Failed jobs flagged for human attention after max retries exhausted.
- **Health monitoring** — Detects slow/unresponsive jobs based on per-task timeout thresholds.
- **Three interfaces** — Web UI (chat + context panel), CLI (`baara`), and scheduled cron. All share the same service layer.

## Authentication

Baara supports two authentication modes:

### Subscription Mode (default)
Uses your Claude Pro/Max/Team subscription via the Claude Code CLI.
No API key needed -- free within your subscription limits.

### API Key Mode
Uses `ANTHROPIC_API_KEY` for per-token billing.
Set `BAARA_AUTH_MODE=api_key` in `.env`.

## Chat API

`POST /api/chat` -- SSE streaming endpoint

**Request:**
```json
{ "message": "Create a task that..." }
```

**Response:** `text/event-stream` with events:
| Event type | Description |
|------------|-------------|
| `text` | Claude's response text (streaming) |
| `tool_use` | Claude calling a Baara tool |
| `tool_result` | Tool execution result |
| `result` | Final response with usage stats |
| `done` | Stream complete |

Claude has access to 14 Baara tools via an in-process MCP server, including `create_task`, `run_task`, `list_tasks`, `list_jobs`, `get_queue_status`, and more. Tools call service functions directly -- no subprocess or HTTP self-calls.

## CLI Reference

```bash
baara tasks list                    # List all tasks
baara tasks create --name <n> --prompt <p> [--cron <expr>] [--type agent_sdk|raw_code]
baara tasks run <name>              # Execute immediately (direct mode)
baara tasks submit <name>           # Dispatch to queue
baara tasks toggle <name>           # Enable/disable

baara jobs list <task>              # Job history
baara jobs triage                   # Failed jobs needing attention
baara jobs retry <job-id>           # Re-dispatch a triaged job

baara queues list                   # Queue depths
baara status                        # Full system overview
baara templates list                # Browse templates
baara logs                          # View execution logs
baara logs --level error            # Filter by level
baara logs --job <id>               # Filter by job ID
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Chat with Claude (SSE stream) |
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create task |
| POST | `/api/tasks/:id/run` | Execute immediately |
| POST | `/api/tasks/:id/submit` | Dispatch to queue |
| GET | `/api/tasks/:id/jobs` | Job history |
| GET | `/api/jobs/triage` | Triaged jobs |
| GET | `/api/queues` | Queue status |
| GET | `/api/logs` | System-wide execution logs |
| GET | `/api/jobs/:id/logs` | Per-job execution logs |
| GET | `/api/status` | System overview |
| GET | `/api/health` | Health check |

## Data Storage

All Baara data lives under `~/.nexus/` (configurable via `NEXUS_DIR` env var):

```
~/.nexus/
├── baara.db              # SQLite database (tasks, jobs, queues, sessions)
├── logs/
│   └── execution.jsonl   # Append-only execution logs (JSONL format)
└── ...
```

- **Database** — SQLite via `bun:sqlite`. Override location with `DB_PATH` env var.
- **Execution logs** — One JSON object per line with `ts`, `level`, `msg`, `taskName`, `jobId` fields. Queryable via `GET /api/logs`, `GET /api/jobs/:id/logs`, or `baara logs` CLI.

## Tech Stack

| Component | Choice |
|-----------|--------|
| Runtime | Bun |
| Web server | Hono |
| Database | bun:sqlite (embedded) |
| Scheduler | Croner |
| AI execution | Claude Agent SDK |
| AI chat | Claude API (streaming via SSE) |
| Tool integration | In-process MCP server (Agent SDK) |
| Frontend | Vanilla JS (no build step) |

## License

MIT
