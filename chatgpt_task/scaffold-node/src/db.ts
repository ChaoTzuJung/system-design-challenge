import Database from 'better-sqlite3';

export type JobStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type JobRow = {
  id: number;
  time_bucket: string;
  description: string;
  scheduled_at: string;
  status: JobStatus;
  result: string | null;
  created_at: string;
  updated_at: string;
};

const DB_PATH = process.env.DB_PATH ?? './chatgpt_task.db';

export function initDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      time_bucket  TEXT NOT NULL,
      description  TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      result       TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bucket_status ON jobs (time_bucket, status);
  `);

  return db;
}
