// Baara — Claude Code Plugin & Command Discovery
// Reads ~/.claude/plugins/ and ~/.claude/commands/ to expose installed
// plugins, skills, agents, and custom slash commands within Baara.

import { readdir, readFile, stat } from "fs/promises";
import { join, basename } from "path";
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

export interface DiscoveredSkill {
  name: string;
  fullName: string;          // "plugin:skill-name" for disambiguation
  pluginName: string;
  description: string;
  triggers: string[];        // keyword patterns from YAML frontmatter
  version?: string;
  path: string;              // Full path to SKILL.md
}

export interface DiscoveredCommand {
  name: string;
  fullName: string;          // "plugin:command" or just "command" for custom
  source: "plugin" | "custom";
  pluginName?: string;
  description: string;
  argumentHint?: string;
  path: string;
}

export interface DiscoveredAgent {
  name: string;
  fullName: string;          // "plugin:agent-name"
  pluginName: string;
  description: string;
  model?: string;
  path: string;
}

export interface ClaudeCodeIntegration {
  plugins: DiscoveredPlugin[];
  commands: string[];
  skills: DiscoveredSkill[];
  deepCommands: DiscoveredCommand[];
  agents: DiscoveredAgent[];
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

// --- YAML Frontmatter Parser ---

export function parseFrontmatter(content: string): Record<string, string | string[]> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const lines = match[1]!.split("\n");
  const result: Record<string, string | string[]> = {};
  let currentKey = "";
  for (const line of lines) {
    const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.+)/);
    if (kvMatch) {
      currentKey = kvMatch[1]!;
      let value = kvMatch[2]!.trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      result[currentKey] = value;
    } else if (line.match(/^\s+-\s+/) && currentKey) {
      // Array item
      if (!Array.isArray(result[currentKey])) result[currentKey] = [];
      const itemMatch = line.match(/^\s+-\s+(?:keyword:\s+)?(.+)/);
      if (itemMatch) (result[currentKey] as string[]).push(itemMatch[1]!.trim());
    }
  }
  return result;
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

/** Check if a path is a directory, returning false on error. */
async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Discover skills from all installed plugins.
 * Traverses <installPath>/skills/ for each plugin,
 * reads SKILL.md in each skill subdirectory, and parses YAML frontmatter.
 */
export async function discoverSkills(): Promise<DiscoveredSkill[]> {
  const plugins = await discoverPlugins();
  const skills: DiscoveredSkill[] = [];

  for (const plugin of plugins) {
    const skillsDir = join(plugin.installPath, "skills");
    if (!(await isDirectory(skillsDir))) continue;

    let entries: string[];
    try {
      entries = await readdir(skillsDir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = join(skillsDir, entry);
      if (!(await isDirectory(entryPath))) continue;

      const skillMdPath = join(entryPath, "SKILL.md");
      let content: string;
      try {
        content = await readFile(skillMdPath, "utf-8");
      } catch {
        // No SKILL.md — skip this directory
        continue;
      }

      const fm = parseFrontmatter(content);
      const name = (typeof fm["name"] === "string" ? fm["name"] : entry) || entry;
      const description = typeof fm["description"] === "string" ? fm["description"] : "";
      const triggers = Array.isArray(fm["triggers"]) ? fm["triggers"] : [];
      const version = typeof fm["version"] === "string" ? fm["version"] : undefined;

      skills.push({
        name,
        fullName: `${plugin.name}:${name}`,
        pluginName: plugin.name,
        description,
        triggers,
        version,
        path: skillMdPath,
      });
    }
  }

  return skills;
}

/**
 * Discover agents from all installed plugins.
 * Traverses <installPath>/agents/ for each plugin,
 * reads .md files and parses YAML frontmatter.
 */
export async function discoverAgents(): Promise<DiscoveredAgent[]> {
  const plugins = await discoverPlugins();
  const agents: DiscoveredAgent[] = [];

  for (const plugin of plugins) {
    const agentsDir = join(plugin.installPath, "agents");
    if (!(await isDirectory(agentsDir))) continue;

    let entries: string[];
    try {
      entries = await readdir(agentsDir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;

      const agentPath = join(agentsDir, entry);
      let content: string;
      try {
        content = await readFile(agentPath, "utf-8");
      } catch {
        continue;
      }

      const fm = parseFrontmatter(content);
      const agentBaseName = entry.replace(/\.md$/, "");
      const name = (typeof fm["name"] === "string" ? fm["name"] : agentBaseName) || agentBaseName;
      const description = typeof fm["description"] === "string" ? fm["description"] : "";
      const model = typeof fm["model"] === "string" ? fm["model"] : undefined;

      agents.push({
        name,
        fullName: `${plugin.name}:${name}`,
        pluginName: plugin.name,
        description,
        model,
        path: agentPath,
      });
    }
  }

  return agents;
}

/**
 * Deep command discovery: reads both custom commands from ~/.claude/commands/
 * and plugin commands from <installPath>/commands/.
 * Parses YAML frontmatter for description and argument-hint.
 */
export async function discoverCommandsDeep(): Promise<DiscoveredCommand[]> {
  const commands: DiscoveredCommand[] = [];

  // 1. Custom commands from ~/.claude/commands/*.md
  const customDir = join(homedir(), ".claude", "commands");
  try {
    const files = await readdir(customDir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      const filePath = join(customDir, file);
      let content: string;
      try {
        content = await readFile(filePath, "utf-8");
      } catch {
        continue;
      }

      const fm = parseFrontmatter(content);
      const cmdName = file.replace(/\.md$/, "");
      const name = (typeof fm["name"] === "string" ? fm["name"] : cmdName) || cmdName;
      const description = typeof fm["description"] === "string" ? fm["description"] : "";
      const argumentHint = typeof fm["argument-hint"] === "string" ? fm["argument-hint"] : undefined;

      commands.push({
        name,
        fullName: name,
        source: "custom",
        description,
        argumentHint,
        path: filePath,
      });
    }
  } catch {
    // Custom commands dir not found — skip
  }

  // 2. Plugin commands from <installPath>/commands/*.md
  const plugins = await discoverPlugins();
  for (const plugin of plugins) {
    const commandsDir = join(plugin.installPath, "commands");
    if (!(await isDirectory(commandsDir))) continue;

    let files: string[];
    try {
      files = await readdir(commandsDir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      const filePath = join(commandsDir, file);
      let content: string;
      try {
        content = await readFile(filePath, "utf-8");
      } catch {
        continue;
      }

      const fm = parseFrontmatter(content);
      const cmdName = file.replace(/\.md$/, "");
      const name = (typeof fm["name"] === "string" ? fm["name"] : cmdName) || cmdName;
      const description = typeof fm["description"] === "string" ? fm["description"] : "";
      const argumentHint = typeof fm["argument-hint"] === "string" ? fm["argument-hint"] : undefined;

      commands.push({
        name,
        fullName: `${plugin.name}:${name}`,
        source: "plugin",
        pluginName: plugin.name,
        description,
        argumentHint,
        path: filePath,
      });
    }
  }

  return commands;
}

/**
 * Read and return the full content of a skill/command/agent markdown file.
 */
export async function getSkillContent(path: string): Promise<string> {
  return readFile(path, "utf-8");
}

/**
 * Full discovery: plugins + commands + skills + agents in a single call.
 * Results are cached with a 60-second TTL to avoid redundant filesystem scans.
 */
let cachedResult: ClaudeCodeIntegration | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000;

export async function discoverAll(): Promise<ClaudeCodeIntegration> {
  if (cachedResult && Date.now() < cacheExpiry) return cachedResult;

  const [plugins, commands, skills, deepCommands, agents] = await Promise.all([
    discoverPlugins(),
    discoverCommands(),
    discoverSkills(),
    discoverCommandsDeep(),
    discoverAgents(),
  ]);
  const result: ClaudeCodeIntegration = {
    plugins,
    commands,
    skills,
    deepCommands,
    agents,
    discoveredAt: new Date().toISOString(),
  };

  cachedResult = result;
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return result;
}

export function clearDiscoveryCache(): void {
  cachedResult = null;
  cacheExpiry = 0;
}
