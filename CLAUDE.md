# Baara — Claude Code Conventions

## Project
Baara ("work" in Bambara) — a delayed task execution system built on the Claude Agent SDK.

## Runtime
- **Bun** (not Node). Run with `bun run src/index.ts` or `bun start`.
- TypeScript files use `.ts` extension with `import ... from "./file.ts"` paths.
- SQLite via `bun:sqlite` (NOT `better-sqlite3` — Bun doesn't support it).

## Key Commands
```bash
bun start                          # Start server (0.0.0.0:3000)
bun run baara tasks list           # CLI
bunx tsc --noEmit                  # Typecheck (run before committing)
make baara ARGS="tasks list"       # Alternative CLI via Makefile
```

## Architecture
- `src/db/` — SQLite schema + Store (all DB access)
- `src/engine/` — Dispatcher, QueueManager, Executor, Scheduler, HealthMonitor
- `src/services/` — TaskService, JobService, TemplateService (business logic)
- `src/server/` — Hono API routes with auth + rate limiting + CSP
- `src/cli/` — Commander-based CLI (`baara` command)
- `web/` — Vanilla JS frontend (no build step)

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
2. `grep -ri "fakoli" src/ web/ package.json` — should return zero
3. Test: `bun start` boots without error
