// Baara — Chat SSE Endpoint

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
import { CHAT_SYSTEM_PROMPT } from "../../chat/system-prompt.ts";

export function chatRoutes(baaraServer: McpSdkServerConfigWithInstance) {
  const app = new Hono();

  app.post("/", async (c) => {
    const { message, sessionId } = await c.req.json<{
      message: string;
      sessionId?: string;
    }>();
    if (!message || typeof message !== "string") {
      return c.json({ error: "message is required" }, 400);
    }

    return streamSSE(c, async (stream) => {
      let eventId = 0;

      const abortController = new AbortController();

      stream.onAbort(() => {
        abortController.abort();
      });

      try {
        // Build options — resume session if sessionId is provided
        const options: Record<string, unknown> = {
          systemPrompt: CHAT_SYSTEM_PROMPT,
          mcpServers: { baara: baaraServer },
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          maxTurns: 20,
          maxBudgetUsd: 0.50,
          includePartialMessages: true,
          abortController,
          tools: [],
        };

        if (sessionId) {
          options.resume = sessionId;
        }

        for await (const msg of query({
          prompt: message,
          options: options as any,
        })) {
          // System init message — MCP status, tools available, session ID
          if (msg.type === "system" && "subtype" in msg && msg.subtype === "init") {
            await stream.writeSSE({
              data: JSON.stringify({
                type: "system",
                tools: msg.tools,
                mcpServers: msg.mcp_servers,
                sessionId: msg.session_id,
              }),
              event: "message",
              id: String(eventId++),
            });
            continue;
          }

          // Full assistant message (complete turn)
          if (msg.type === "assistant") {
            const contentBlocks = msg.message.content;
            for (const block of contentBlocks) {
              if (block.type === "text") {
                await stream.writeSSE({
                  data: JSON.stringify({ type: "text", content: block.text }),
                  event: "message",
                  id: String(eventId++),
                });
              } else if (block.type === "tool_use") {
                await stream.writeSSE({
                  data: JSON.stringify({
                    type: "tool_use",
                    name: block.name,
                    input: block.input,
                  }),
                  event: "message",
                  id: String(eventId++),
                });
              } else if (block.type === "mcp_tool_use") {
                await stream.writeSSE({
                  data: JSON.stringify({
                    type: "tool_use",
                    name: block.name,
                    input: block.input,
                  }),
                  event: "message",
                  id: String(eventId++),
                });
              } else if (block.type === "mcp_tool_result") {
                await stream.writeSSE({
                  data: JSON.stringify({
                    type: "tool_result",
                    output: block.content,
                    isError: block.is_error,
                  }),
                  event: "message",
                  id: String(eventId++),
                });
              }
            }
            continue;
          }

          // Partial streaming (real-time text as it arrives)
          if (msg.type === "stream_event") {
            const event = msg.event;
            if (event.type === "content_block_delta") {
              const delta = event.delta;
              if (delta.type === "text_delta") {
                await stream.writeSSE({
                  data: JSON.stringify({
                    type: "text_delta",
                    content: delta.text,
                  }),
                  event: "message",
                  id: String(eventId++),
                });
              }
            }
            continue;
          }

          // Final result
          if (msg.type === "result") {
            const resultText = "result" in msg ? (msg as Record<string, unknown>)["result"] : undefined;
            const usage = msg.usage;
            const costUsd = msg.total_cost_usd;
            await stream.writeSSE({
              data: JSON.stringify({
                type: "result",
                text: resultText ?? null,
                isError: msg.is_error,
                usage: {
                  inputTokens: usage.input_tokens,
                  outputTokens: usage.output_tokens,
                },
                costUsd,
                durationMs: msg.duration_ms,
              }),
              event: "message",
              id: String(eventId++),
            });
            continue;
          }
        }
      } catch (err) {
        console.error("[chat] stream error:", err);
        await stream.writeSSE({
          data: JSON.stringify({
            type: "error",
            message: "An error occurred processing your request. Please try again.",
          }),
          event: "message",
          id: String(eventId++),
        });
      }

      // Signal end of stream
      await stream.writeSSE({
        data: JSON.stringify({ type: "done" }),
        event: "done",
        id: String(eventId++),
      });
    });
  });

  return app;
}
