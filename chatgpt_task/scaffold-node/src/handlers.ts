import type Database from 'better-sqlite3';

import type { JobRow } from './db.js';
import { getTimeBucket } from './scheduler.js';

export type CreateTaskInput = {
  description: string;
  scheduled_at: string;
};

export type JobIdInput = {
  job_id: number;
};

export type HandlerResult = Record<string, unknown>;

export function handleCreateTask(
  db: Database.Database,
  { description, scheduled_at }: CreateTaskInput,
): HandlerResult {
  const dt = new Date(scheduled_at);
  if (Number.isNaN(dt.getTime())) {
    return { error: `Invalid scheduled_at: ${scheduled_at} (expected ISO 8601)` };
  }

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO jobs (time_bucket, description, scheduled_at, status, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
    )
    .run(getTimeBucket(dt), description, dt.toISOString(), now, now);

  return {
    job_id: Number(info.lastInsertRowid),
    status: 'pending',
    scheduled_at: dt.toISOString(),
  };
}

export function handleGetStatus(
  db: Database.Database,
  { job_id }: JobIdInput,
): HandlerResult {
  const job = db.prepare<[number], JobRow>(`SELECT * FROM jobs WHERE id = ?`).get(job_id);
  if (!job) return { error: `Job ${job_id} not found` };
  return {
    job_id: job.id,
    description: job.description,
    status: job.status,
    scheduled_at: job.scheduled_at,
    result: job.result,
  };
}

export function handleListTasks(db: Database.Database): HandlerResult {
  const jobs = db
    .prepare<[], JobRow>(`SELECT * FROM jobs ORDER BY scheduled_at DESC`)
    .all();
  return {
    jobs: jobs.map((j) => ({
      job_id: j.id,
      description: j.description,
      status: j.status,
      scheduled_at: j.scheduled_at,
    })),
  };
}

export function handleCancelTask(
  db: Database.Database,
  { job_id }: JobIdInput,
): HandlerResult {
  const job = db.prepare<[number], JobRow>(`SELECT * FROM jobs WHERE id = ?`).get(job_id);
  if (!job) return { error: `Job ${job_id} not found` };
  if (job.status === 'completed' || job.status === 'failed') {
    return { error: `Cannot cancel job in '${job.status}' state` };
  }
  db.prepare(`UPDATE jobs SET status = 'cancelled', updated_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    job_id,
  );
  return { job_id, status: 'cancelled' };
}
