# Contributing to Baara

## Dev Setup

```bash
# Clone
git clone git@github.com:sdoumbouya/baara.git
cd baara

# Install
bun install

# Create .env
cp .env.example .env
# Add your ANTHROPIC_API_KEY

# Start
bun start
```

## Project Structure

```
src/
  types.ts          — Shared types (Task, Job, AgentConfig, etc.)
  config.ts         — Environment configuration
  index.ts          — Entry point (wires DB, services, engine, server)
  db/               — SQLite schema + Store
  engine/           — Core: Dispatcher, QueueManager, Executor, Scheduler
  services/         — Business logic: TaskService, JobService, TemplateService
  server/           — Hono REST API routes
  cli/              — Commander CLI (baara command)
web/                — Vanilla JS frontend (no build step)
```

## Adding a New Execution Type

1. Add the type to `ExecutionType` in `src/types.ts`
2. Add a `case` in `src/engine/executor.ts` `executeJob()` switch
3. Implement the execution function
4. Update CLI `--type` option in `src/cli/commands/tasks.ts`

## Testing

```bash
# Typecheck
bunx tsc --noEmit

# Manual test
bun start &
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/tasks -H "Content-Type: application/json" \
  -d '{"name":"test","prompt":"echo hello","executionType":"raw_code"}'
```

## Commit Convention

```
feat: add new feature
fix: fix a bug
docs: documentation only
refactor: code change that neither fixes a bug nor adds a feature
```
