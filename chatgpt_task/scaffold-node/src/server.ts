import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { initDb } from './db.js';
import {
  handleCancelTask,
  handleCreateTask,
  handleGetStatus,
  handleListTasks,
  type HandlerResult,
} from './handlers.js';
import { startScheduler } from './scheduler.js';

const db = initDb();

const server = new McpServer({
  name: 'task-scheduler',
  version: '1.0.0',
});

const asText = (result: HandlerResult) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
});

server.registerTool(
  'task.create',
  {
    title: 'Create scheduled task',
    description: 'Schedule a new task for future execution',
    inputSchema: {
      description: z.string().describe('What the task should do'),
      scheduled_at: z
        .string()
        .describe('When to run, ISO 8601 format (e.g. 2026-05-03T10:00:00Z)'),
    },
  },
  async (args) => asText(handleCreateTask(db, args)),
);

server.registerTool(
  'task.list',
  {
    title: 'List scheduled tasks',
    description: 'List all scheduled tasks',
  },
  async () => asText(handleListTasks(db)),
);

server.registerTool(
  'task.status',
  {
    title: 'Get task status',
    description: 'Get the status of a scheduled task by job_id',
    inputSchema: {
      job_id: z.number().int().describe('The job ID returned by task.create'),
    },
  },
  async (args) => asText(handleGetStatus(db, args)),
);

server.registerTool(
  'task.cancel',
  {
    title: 'Cancel scheduled task',
    description: "Cancel a scheduled task that hasn't completed yet",
    inputSchema: {
      job_id: z.number().int().describe('The job ID to cancel'),
    },
  },
  async (args) => asText(handleCancelTask(db, args)),
);

server.registerPrompt(
  'daily_review',
  {
    title: 'Daily review',
    description: 'Generate a daily review prompt summarising scheduled tasks',
    argsSchema: {
      date: z.string().describe('Date to review, ISO 8601 (YYYY-MM-DD)'),
    },
  },
  ({ date }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Review every scheduled task for ${date}. For each task, decide whether it is still relevant, list blockers, and suggest the next concrete action.`,
        },
      },
    ],
  }),
);

async function main() {
  startScheduler(db);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[task-scheduler] MCP stdio server ready');
}

main().catch((err) => {
  console.error('[task-scheduler] fatal:', err);
  process.exit(1);
});

const shutdown = async () => {
  try {
    await server.close();
  } finally {
    db.close();
    process.exit(0);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
