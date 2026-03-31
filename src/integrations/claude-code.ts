// Baara — Claude Code Plugin & Command Discovery
// Reads ~/.claude/plugins/ and ~/.claude/commands/ to expose installed
// plugins, skills, agents, and custom slash commands within Baara.

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { log } from "../logger.ts";

// --- Types ---

export interface DiscoveredPlugin {
  name: string;
  description: string;
  version: string;
  author: string;
  marketplace: string;
  installPath: string;
  installedAt: string;
  keywords: string[];
}

export interface ClaudeCodeIntegration {
  plugins: DiscoveredPlugin[];
  commands: string[];
  discoveredAt: string;
}

// --- Internals ---

interface InstalledPluginsFile {
  version: number;
  plugins: Record<string, Array<{
    scope: string;
    installPath: string;
    version: string;
    installedAt: string;
    lastUpdated: string;
    gitCommitSha: string;
  }>>;
}

interface PluginManifest {
  name?: string;
  description?: string;
  version?: string;
  author?: { name?: string; email?: string; url?: string } | string;
  keywords?: string[];
}

// --- Discovery Functions ---

/**
 * Read the installed_plugins.json registry and each plugin's plugin.json
 * manifest to build a list of discovered plugins with metadata.
 */
export async function discoverPlugins(): Promise<DiscoveredPlugin[]> {
  const pluginsDir = join(homedir(), ".claude", "plugins");
  const registryPath = join(pluginsDir, "installed_plugins.json");

  let registry: InstalledPluginsFile;
  try {
    const raw = await readFile(registryPath, "utf-8");
    registry = JSON.parse(raw) as InstalledPluginsFile;
  } catch {
    log("warn", "claude-code", "Could not read installed_plugins.json — no plugins discovered");
    return [];
  }

  const discovered: DiscoveredPlugin[] = [];

  for (const [key, entries] of Object.entries(registry.plugins)) {
    if (!entries || entries.length === 0) continue;
    const entry = entries[0]!;

    // key format: "plugin-name@marketplace"
    const atIndex = key.lastIndexOf("@");
    const pluginName = atIndex > 0 ? key.slice(0, atIndex) : key;
    const marketplace = atIndex > 0 ? key.slice(atIndex + 1) : "unknown";

    // Try to read plugin.json from the install path
    const manifestPath = join(entry.installPath, ".claude-plugin", "plugin.json");
    let manifest: PluginManifest = {};
    try {
      const raw = await readFile(manifestPath, "utf-8");
      manifest = JSON.parse(raw) as PluginManifest;
    } catch {
      // Manifest not found or unreadable — use registry data only
    }

    const authorStr = typeof manifest.author === "string"
      ? manifest.author
      : manifest.author?.name ?? "";

    discovered.push({
      name: manifest.name ?? pluginName,
      description: manifest.description ?? "",
      version: manifest.version ?? entry.version ?? "unknown",
      author: authorStr,
      marketplace,
      installPath: entry.installPath,
      installedAt: entry.installedAt,
      keywords: manifest.keywords ?? [],
    });
  }

  return discovered;
}

/**
 * Read ~/.claude/commands/ for custom slash command files (.md).
 * Returns the list of command names (filenames without extension).
 */
export async function discoverCommands(): Promise<string[]> {
  const commandsDir = join(homedir(), ".claude", "commands");
  try {
    const files = await readdir(commandsDir);
    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""));
  } catch {
    return [];
  }
}

/**
 * Full discovery: plugins + commands in a single call.
 */
export async function discoverAll(): Promise<ClaudeCodeIntegration> {
  const [plugins, commands] = await Promise.all([
    discoverPlugins(),
    discoverCommands(),
  ]);
  return {
    plugins,
    commands,
    discoveredAt: new Date().toISOString(),
  };
}
