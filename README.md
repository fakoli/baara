# Baara

> *"Baara"* means "work" in Bambara/Mandinka.

A delayed task execution system built on the Claude Agent SDK. Schedule AI-powered tasks with priority queues, failure triage, and at-least-once delivery semantics. Runs as a single binary on a Mac mini.

```
┌─────────────────────────────────────────────────────┐
│                      Baara                          │
│                                                     │
│  CLI ──┐                                            │
│  Web ──┼──► Services ──► Dispatcher ──► Executor    │
│  Cron ─┘        │         │    │         │          │
│                 │      Queue   Direct    Agent SDK   │
│                 │      Manager  Mode     Raw Code    │
│                 │         │              Wasm        │
│                 └──► SQLite ◄────────────┘           │
└─────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install
bun install

# Configure
cp .env.example .env
# Add your ANTHROPIC_API_KEY

# Start server (http://0.0.0.0:3000)
bun start

# Or use the CLI
bun run src/cli/index.ts tasks list
bun run src/cli/index.ts status
```

## Features

- **Chat-first UI** — Claude-inspired interface. Describe what you want in natural language.
- **Priority queues** — P0 (critical) through P3 (background) with FIFO tie-breaking.
- **Dual execution modes** — Queued (full pipeline) or Direct (immediate, ideal for Mac mini).
- **Agent SDK integration** — Built-in tools (WebSearch, WebFetch, Bash), MCP servers, subagents.
- **Failure triage** — Failed jobs flagged for human attention after max retries exhausted.
- **Health monitoring** — Detects slow/unresponsive jobs based on per-task timeout thresholds.
- **Three interfaces** — Web UI, CLI (`baara`), and scheduled cron. All share the same service layer.

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
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create task |
| POST | `/api/tasks/:id/run` | Execute immediately |
| POST | `/api/tasks/:id/submit` | Dispatch to queue |
| GET | `/api/tasks/:id/jobs` | Job history |
| GET | `/api/jobs/triage` | Triaged jobs |
| GET | `/api/queues` | Queue status |
| GET | `/api/status` | System overview |
| GET | `/api/health` | Health check |

## Tech Stack

| Component | Choice |
|-----------|--------|
| Runtime | Bun |
| Web server | Hono |
| Database | bun:sqlite (embedded) |
| Scheduler | Croner |
| AI execution | Claude Agent SDK |
| Frontend | Vanilla JS (no build step) |

## License

MIT
