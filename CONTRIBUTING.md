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
# Default: subscription mode (uses Claude CLI, no API key needed)
# Optional: set BAARA_AUTH_MODE=api_key and add ANTHROPIC_API_KEY

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
  chat/             — Claude-powered agentic chat
    tools.ts        — 14 Baara tools (create_task, run_task, list_jobs, etc.)
    system-prompt.ts — System prompt for chat Claude
  server/routes/
    chat.ts         — POST /api/chat SSE endpoint
  cli/              — Commander CLI (baara command)
web/                — Vanilla JS frontend (no build step)
```

## Chat API Contract

The chat endpoint (`POST /api/chat`) uses Server-Sent Events (SSE) to stream Claude's responses.

**Request:**
```
POST /api/chat
Content-Type: application/json

{ "message": "Create a daily backup task" }
```

**Response:** `text/event-stream` with the following event types:

| Event | Data shape | Description |
|-------|-----------|-------------|
| `text` | `{ text: string }` | Incremental text from Claude (streamed token by token) |
| `tool_use` | `{ tool: string, input: object }` | Claude is calling a Baara tool (e.g. `create_task`) |
| `tool_result` | `{ tool: string, result: object }` | Result of the tool execution |
| `result` | `{ text: string, usage: object }` | Final assembled response with token usage stats |
| `done` | `{}` | Stream complete, client can close connection |

The frontend should update the context panel (tasks/jobs/queues) whenever a `tool_result` event arrives.

## Adding a New Chat Tool

1. Define the tool in `src/chat/tools.ts` using `tool()` from the Agent SDK:

```typescript
const myTool = tool({
  name: "my_tool",
  description: "Does something useful",
  parameters: z.object({
    param1: z.string().describe("Description of param1"),
  }),
  async execute({ param1 }) {
    // Call service functions directly -- no HTTP self-calls
    const result = await someService.doSomething(param1);
    return result;
  },
});
```

2. Add the tool to the array returned by `createBaaraTools()`
3. The tool is automatically exposed via the in-process MCP server and available in chat as `mcp__baara__my_tool`
4. No frontend changes needed -- the chat UI renders tool calls and results generically

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
