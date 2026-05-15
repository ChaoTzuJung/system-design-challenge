import type Database from 'better-sqlite3';

import type { JobRow } from './db.js';

export function getTimeBucket(scheduledAt: Date): string {
  const iso = scheduledAt.toISOString();
  return iso.slice(0, 4) + iso.slice(5, 7) + iso.slice(8, 10) + iso.slice(11, 13);
}

export function findDueJobs(currentTime: Date, db: Database.Database): JobRow[] {
  const bucket = getTimeBucket(currentTime);
  // Catch-up scan: current bucket plus any older bucket that still has
  // pending rows. `status = 'pending'` already filters most of the past;
  // the composite index (time_bucket, status) keeps the scan cheap.
  const stmt = db.prepare<[string, string], JobRow>(
    `SELECT * FROM jobs
       WHERE time_bucket <= ?
         AND status = 'pending'
         AND scheduled_at <= ?`,
  );
  return stmt.all(bucket, currentTime.toISOString());
}

const jobQueue: number[] = [];
let queueNotify: (() => void) | null = null;

function enqueue(jobId: number): void {
  jobQueue.push(jobId);
  if (queueNotify) {
    const notify = queueNotify;
    queueNotify = null;
    notify();
  }
}

function watcherTick(db: Database.Database): void {
  const now = new Date();
  const due = findDueJobs(now, db);
  const update = db.prepare(
    `UPDATE jobs SET status = 'queued', updated_at = ? WHERE id = ? AND status = 'pending'`,
  );
  for (const job of due) {
    const info = update.run(now.toISOString(), job.id);
    if (info.changes === 1) {
      enqueue(job.id);
    }
  }
}

async function workerLoop(db: Database.Database): Promise<void> {
  const selectJob = db.prepare<[number], JobRow>(`SELECT * FROM jobs WHERE id = ?`);
  const markRunning = db.prepare(
    `UPDATE jobs SET status = 'running', updated_at = ? WHERE id = ? AND status = 'queued'`,
  );
  const markCompleted = db.prepare(
    `UPDATE jobs SET status = 'completed', result = ?, updated_at = ? WHERE id = ?`,
  );
  const markFailed = db.prepare(
    `UPDATE jobs SET status = 'failed', result = ?, updated_at = ? WHERE id = ?`,
  );

  while (true) {
    if (jobQueue.length === 0) {
      await new Promise<void>((resolve) => {
        queueNotify = resolve;
      });
      continue;
    }

    const jobId = jobQueue.shift()!;
    const job = selectJob.get(jobId);
    if (!job || job.status === 'cancelled') continue;

    const startedAt = new Date().toISOString();
    const info = markRunning.run(startedAt, jobId);
    if (info.changes === 0) continue;

    try {
      const result = `Executed: ${job.description}`;
      markCompleted.run(result, new Date().toISOString(), jobId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      markFailed.run(message, new Date().toISOString(), jobId);
    }
  }
}

export function startScheduler(db: Database.Database, intervalMs = 10_000): void {
  setInterval(() => {
    try {
      watcherTick(db);
    } catch (err) {
      console.error('[watcher] tick failed:', err);
    }
  }, intervalMs).unref();

  void workerLoop(db).catch((err) => {
    console.error('[worker] fatal:', err);
  });
}
