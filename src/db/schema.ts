// Baara — Database Schema & Migrations

import { Database } from "bun:sqlite";

export function initDatabase(dbPath: string): Database {
  const db = new Database(dbPath, { create: true });

  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      prompt TEXT NOT NULL,
      scheduled_at TEXT,
      cron_expression TEXT,
      timeout_ms INTEGER DEFAULT 300000,
      execution_type TEXT NOT NULL DEFAULT 'agent_sdk',
      agent_config TEXT,
      priority INTEGER DEFAULT 1,
      target_queue TEXT DEFAULT 'default',
      max_retries INTEGER DEFAULT 0,
      execution_mode TEXT DEFAULT 'direct',
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      queue_name TEXT NOT NULL,
      priority INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempt INTEGER NOT NULL DEFAULT 1,
      scheduled_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      duration_ms INTEGER,
      output TEXT,
      error TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      health_status TEXT DEFAULT 'healthy',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      agent_config TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS queues (
      name TEXT PRIMARY KEY,
      max_concurrency INTEGER DEFAULT 3,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_task
      ON jobs(task_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_jobs_queue_priority
      ON jobs(queue_name, status, priority ASC, created_at ASC);
  `);

  // Seed default queue
  db.prepare(
    "INSERT OR IGNORE INTO queues (name, max_concurrency) VALUES ('default', 3)"
  ).run();

  return db;
}
