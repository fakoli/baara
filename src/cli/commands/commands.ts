// Baara — CLI Commands (Slash Commands / Skills / Agents discovery)

import { Command } from "commander";
import {
  discoverSkills,
  discoverCommandsDeep,
  discoverAgents,
  getSkillContent,
} from "../../integrations/claude-code.ts";
import type {
  DiscoveredSkill,
  DiscoveredCommand,
  DiscoveredAgent,
} from "../../integrations/claude-code.ts";
import { formatTable, formatJson } from "../formatter.ts";

type ItemType = "all" | "skills" | "commands" | "agents";

/** Fetch items based on type filter. */
async function fetchByType(type: ItemType): Promise<{
  skills: DiscoveredSkill[];
  commands: DiscoveredCommand[];
  agents: DiscoveredAgent[];
}> {
  const [skills, commands, agents] = await Promise.all([
    type === "all" || type === "skills" ? discoverSkills() : Promise.resolve([]),
    type === "all" || type === "commands" ? discoverCommandsDeep() : Promise.resolve([]),
    type === "all" || type === "agents" ? discoverAgents() : Promise.resolve([]),
  ]);
  return { skills, commands, agents };
}

/** Apply a search filter across names, descriptions, and triggers. */
function applySearch(
  data: { skills: DiscoveredSkill[]; commands: DiscoveredCommand[]; agents: DiscoveredAgent[] },
  query: string,
): { skills: DiscoveredSkill[]; commands: DiscoveredCommand[]; agents: DiscoveredAgent[] } {
  if (!query) return data;
  const q = query.toLowerCase();
  return {
    skills: data.skills.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.fullName.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.triggers.some((t) => t.toLowerCase().includes(q))
    ),
    commands: data.commands.filter((cmd) =>
      cmd.name.toLowerCase().includes(q) ||
      cmd.fullName.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q)
    ),
    agents: data.agents.filter((a) =>
      a.name.toLowerCase().includes(q) ||
      a.fullName.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q)
    ),
  };
}

/** Format skills for table display. */
function formatSkillsTable(skills: DiscoveredSkill[]): string {
  if (skills.length === 0) return "  No skills found.";
  const rows = skills.map((s) => ({
    fullName: s.fullName,
    description: s.description.length > 50 ? s.description.substring(0, 47) + "..." : s.description,
    triggers: s.triggers.slice(0, 3).join(", "),
  }));
  return formatTable(rows, [
    { key: "fullName", header: "Name", width: 30 },
    { key: "description", header: "Description", width: 52 },
    { key: "triggers", header: "Triggers", width: 25 },
  ]);
}

/** Format commands for table display. */
function formatCommandsTable(commands: DiscoveredCommand[]): string {
  if (commands.length === 0) return "  No commands found.";
  const rows = commands.map((cmd) => ({
    fullName: cmd.fullName,
    source: cmd.source,
    description: cmd.description.length > 50 ? cmd.description.substring(0, 47) + "..." : cmd.description,
    hint: cmd.argumentHint ?? "--",
  }));
  return formatTable(rows, [
    { key: "fullName", header: "Name", width: 30 },
    { key: "source", header: "Source", width: 8 },
    { key: "description", header: "Description", width: 45 },
    { key: "hint", header: "Arg Hint", width: 20 },
  ]);
}

/** Format agents for table display. */
function formatAgentsTable(agents: DiscoveredAgent[]): string {
  if (agents.length === 0) return "  No agents found.";
  const rows = agents.map((a) => ({
    fullName: a.fullName,
    description: a.description.length > 50 ? a.description.substring(0, 47) + "..." : a.description,
    model: a.model ?? "(default)",
  }));
  return formatTable(rows, [
    { key: "fullName", header: "Name", width: 30 },
    { key: "description", header: "Description", width: 52 },
    { key: "model", header: "Model", width: 20 },
  ]);
}

/** Print discovered items in formatted or JSON output. */
function printResults(
  data: { skills: DiscoveredSkill[]; commands: DiscoveredCommand[]; agents: DiscoveredAgent[] },
  type: ItemType,
  json: boolean,
): void {
  const total = data.skills.length + data.commands.length + data.agents.length;

  if (json) {
    console.log(formatJson({ ...data, total }));
    return;
  }

  if (total === 0) {
    console.log("  No items found.");
    return;
  }

  if (data.skills.length > 0) {
    console.log(`\n  Skills (${data.skills.length}):`);
    console.log(formatSkillsTable(data.skills));
  }

  if (data.commands.length > 0) {
    console.log(`\n  Commands (${data.commands.length}):`);
    console.log(formatCommandsTable(data.commands));
  }

  if (data.agents.length > 0) {
    console.log(`\n  Agents (${data.agents.length}):`);
    console.log(formatAgentsTable(data.agents));
  }

  console.log(`\n  Total: ${total}`);
}

export function registerCommandsCommand(program: Command): void {
  const commands = program
    .command("commands")
    .description("Discover slash commands, skills, and agents from Claude Code plugins");

  // --- list ---
  commands
    .command("list")
    .description("List all discovered commands, skills, and agents")
    .option("--type <type>", "Filter by type: all, skills, commands, agents", "all")
    .option("--json", "Output as JSON")
    .action(async (opts: { type: string; json?: boolean }) => {
      try {
        const type = opts.type as ItemType;
        const data = await fetchByType(type);
        printResults(data, type, !!opts.json);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  // --- search ---
  commands
    .command("search <query>")
    .description("Search commands, skills, and agents by keyword")
    .option("--type <type>", "Filter by type: all, skills, commands, agents", "all")
    .option("--json", "Output as JSON")
    .action(async (query: string, opts: { type: string; json?: boolean }) => {
      try {
        const type = opts.type as ItemType;
        const raw = await fetchByType(type);
        const data = applySearch(raw, query);
        printResults(data, type, !!opts.json);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  // --- show ---
  commands
    .command("show <name>")
    .description("Show the full markdown content of a skill, command, or agent")
    .action(async (name: string) => {
      try {
        // Search across all types for a matching name
        const [skills, cmds, agents] = await Promise.all([
          discoverSkills(),
          discoverCommandsDeep(),
          discoverAgents(),
        ]);

        const skill = skills.find((s) => s.fullName === name || s.name === name);
        if (skill) {
          const content = await getSkillContent(skill.path);
          console.log(content);
          return;
        }

        const cmd = cmds.find((c) => c.fullName === name || c.name === name);
        if (cmd) {
          const content = await getSkillContent(cmd.path);
          console.log(content);
          return;
        }

        const agent = agents.find((a) => a.fullName === name || a.name === name);
        if (agent) {
          const content = await getSkillContent(agent.path);
          console.log(content);
          return;
        }

        console.error(`Error: Not found: ${name}`);
        console.error("  Use 'baara commands list' to see available items.");
        process.exit(1);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  // --- run ---
  commands
    .command("run <name>")
    .description("Run a skill by loading its content (outputs to stdout)")
    .option("--args <arguments>", "Arguments to pass to the skill")
    .action(async (name: string, opts: { args?: string }) => {
      try {
        const skills = await discoverSkills();
        const skill = skills.find((s) => s.fullName === name || s.name === name);

        if (!skill) {
          console.error(`Error: Skill not found: ${name}`);
          const available = skills.map((s) => s.fullName).join(", ");
          if (available) console.error(`  Available: ${available}`);
          process.exit(1);
        }

        const content = await getSkillContent(skill.path);
        console.log(`# Skill: ${skill.fullName}`);
        if (skill.description) console.log(`> ${skill.description}`);
        if (opts.args) console.log(`\nArguments: ${opts.args}`);
        console.log("\n---\n");
        console.log(content);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
