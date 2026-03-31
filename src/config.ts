// Baara — Configuration

export interface Config {
  port: number;
  host: string;
  dbPath: string;
  staticDir: string;
  defaultExecutionMode: "queued" | "direct";
  anthropicApiKey: string;
  authMode: "subscription" | "api_key";
}

export function loadConfig(): Config {
  const anthropicApiKey = process.env["ANTHROPIC_API_KEY"] ?? "";
  if (!anthropicApiKey) {
    console.warn("Warning: ANTHROPIC_API_KEY not set. Agent SDK tasks will fail.");
  }

  return {
    port: parseInt(process.env["PORT"] ?? "3000", 10),
    host: process.env["HOST"] ?? "0.0.0.0",
    dbPath: process.env["DB_PATH"] ?? "data/baara.db",
    staticDir: process.env["STATIC_DIR"] ?? "web",
    defaultExecutionMode:
      (process.env["DEFAULT_EXECUTION_MODE"] as "queued" | "direct") ?? "direct",
    anthropicApiKey,
    authMode:
      (process.env["BAARA_AUTH_MODE"] as "subscription" | "api_key") ?? "subscription",
  };
}
