// Baara — Configuration

import { homedir } from "os";
import { join } from "path";
import { log } from "./logger.ts";

// ~/.nexus is Baara's home directory
const DEFAULT_NEXUS_DIR = join(homedir(), ".nexus");

export interface Config {
  nexusDir: string;
  port: number;
  host: string;
  dbPath: string;
  logsDir: string;
  sessionsDir: string;
  staticDir: string;
  defaultExecutionMode: "queued" | "direct";
  anthropicApiKey: string;
  authMode: "subscription" | "api_key";
}

export function loadConfig(): Config {
  const anthropicApiKey = process.env["ANTHROPIC_API_KEY"] ?? "";
  if (!anthropicApiKey) {
    log("warn", "config", "ANTHROPIC_API_KEY not set - Agent SDK tasks will fail");
  }

  const nexusDir = process.env["NEXUS_DIR"] ?? DEFAULT_NEXUS_DIR;

  return {
    nexusDir,
    port: parseInt(process.env["PORT"] ?? "3000", 10),
    host: process.env["HOST"] ?? "0.0.0.0",
    dbPath: process.env["DB_PATH"] ?? join(nexusDir, "baara.db"),
    logsDir: join(nexusDir, "logs"),
    sessionsDir: join(nexusDir, "sessions"),
    staticDir: process.env["STATIC_DIR"] ?? "web",
    defaultExecutionMode:
      (process.env["DEFAULT_EXECUTION_MODE"] as "queued" | "direct") ?? "direct",
    anthropicApiKey,
    authMode:
      (process.env["BAARA_AUTH_MODE"] as "subscription" | "api_key") ?? "subscription",
  };
}
