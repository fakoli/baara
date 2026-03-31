# Baara — Claude Code Conventions

## Project
Baara ("work" in Bambara) — a delayed task execution system built on the Claude Agent SDK.

## Runtime
- **Bun** (not Node). Run with `bun run src/index.ts` or `bun start`.
- TypeScript files use `.ts` extension with `import ... from "./file.ts"` paths.
- SQLite via `bun:sqlite` (NOT `better-sqlite3` — Bun doesn't support it).

## Key Commands
```bash
bun start              # Start server (0.0.0.0:3000)
bun run src/cli/index.ts tasks list   # CLI
bunx tsc --noEmit      # Typecheck (run before committing)
```

## Architecture
- `src/db/` — SQLite schema + Store (all DB access)
- `src/engine/` — Dispatcher, QueueManager, Executor, Scheduler, HealthMonitor
- `src/services/` — TaskService, JobService, TemplateService (business logic)
- `src/server/` — Hono API routes
- `src/cli/` — Commander-based CLI
- `web/` — Vanilla JS frontend (no build step)

## Conventions
- Server binds `0.0.0.0` (not `127.0.0.1`) for cross-machine access from laptop
- CORS allows localhost, 127.0.0.1, 10.0.0.* subnet, fakoli-mini hostname
- All interfaces (Web, CLI, Cron) call the same service functions — no duplicated logic
- `executionMode: "direct"` is the default (bypasses queue, immediate execution)
- Agent SDK tasks use `permissionMode: "bypassPermissions"` for unattended execution
- `raw_code` execution type runs arbitrary shell — privileged operation, no auth gate

## Before Committing
1. `bunx tsc --noEmit` — zero errors
2. `grep -ri "fakoli" src/ web/ package.json` — should return zero (renamed to Baara)
3. Test: `bun start` boots without error
