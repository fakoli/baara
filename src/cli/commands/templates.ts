// Fakoli Mini — CLI Templates Commands

import { Command } from "commander";
import type { TemplateService } from "../../services/template-service.ts";
import type { Store } from "../../db/store.ts";
import type { CreateTemplateInput } from "../../types.ts";
import { formatTemplateTable, formatJson } from "../formatter.ts";

function resolveTemplate(store: Store, idOrName: string) {
  const byId = store.getTemplate(idOrName);
  if (byId) return byId;
  // No getTemplateByName — scan the list
  const all = store.listTemplates();
  return all.find((t) => t.name === idOrName) ?? null;
}

export function registerTemplatesCommand(
  program: Command,
  store: Store,
  templateService: TemplateService,
): void {
  const templates = program
    .command("templates")
    .description("Manage templates");

  // --- list ---
  templates
    .command("list")
    .description("List all templates")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      const allTemplates = templateService.listTemplates();
      if (opts.json) {
        console.log(formatJson(allTemplates));
      } else {
        console.log(formatTemplateTable(allTemplates));
      }
    });

  // --- create ---
  templates
    .command("create")
    .description("Create a new template")
    .requiredOption("--name <name>", "Template name")
    .requiredOption("--tools <tools>", "Comma-separated list of allowed tools")
    .option("--model <model>", "Agent model")
    .option("--system-prompt <prompt>", "System prompt")
    .option("--description <desc>", "Template description")
    .option("--json", "Output as JSON")
    .action(
      (opts: {
        name: string;
        tools: string;
        model?: string;
        systemPrompt?: string;
        description?: string;
        json?: boolean;
      }) => {
        const input: CreateTemplateInput = {
          name: opts.name,
          description: opts.description,
          agentConfig: {
            allowedTools: opts.tools.split(",").map((t) => t.trim()),
            model: opts.model,
            systemPrompt: opts.systemPrompt,
          },
        };
        const template = templateService.createTemplate(input);
        if (opts.json) {
          console.log(formatJson(template));
        } else {
          console.log(`Created template: ${template.name} (${template.id})`);
        }
      },
    );

  // --- use ---
  templates
    .command("use <id-or-name>")
    .description("Create a task from a template")
    .requiredOption("--task-name <name>", "Task name")
    .requiredOption("--prompt <prompt>", "Task prompt")
    .option("--json", "Output as JSON")
    .action(
      (
        idOrName: string,
        opts: { taskName: string; prompt: string; json?: boolean },
      ) => {
        const template = resolveTemplate(store, idOrName);
        if (!template) {
          console.error(`Error: Template not found: ${idOrName}`);
          process.exit(1);
        }
        const task = templateService.createTaskFromTemplate(template.id, {
          name: opts.taskName,
          prompt: opts.prompt,
        });
        if (opts.json) {
          console.log(formatJson(task));
        } else {
          console.log(
            `Created task from template: ${task.name} (${task.id})`,
          );
        }
      },
    );
}
