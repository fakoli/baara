// Baara — Template Service

import type { Store } from "../db/store.ts";
import type { TaskService } from "./task-service.ts";
import type { Template, CreateTemplateInput, Task, CreateTaskInput } from "../types.ts";

export class TemplateService {
  constructor(private store: Store, private taskService: TaskService) {}

  listTemplates(): Template[] { return this.store.listTemplates(); }
  getTemplate(id: string): Template | null { return this.store.getTemplate(id); }

  createTemplate(input: CreateTemplateInput): Template {
    return this.store.createTemplate(crypto.randomUUID(), input);
  }

  deleteTemplate(id: string): void { this.store.deleteTemplate(id); }

  createTaskFromTemplate(templateId: string, overrides: Partial<CreateTaskInput>): Task {
    const template = this.store.getTemplate(templateId);
    if (!template) throw new Error(`Template not found: ${templateId}`);

    if (!overrides.prompt) {
      throw new Error("prompt is required when creating a task from a template");
    }

    const input: CreateTaskInput = {
      name: overrides.name ?? template.name,
      description: overrides.description ?? template.description,
      prompt: overrides.prompt,
      agentConfig: overrides.agentConfig ?? template.agentConfig,
      ...overrides,
    };

    return this.taskService.createTask(input);
  }
}
