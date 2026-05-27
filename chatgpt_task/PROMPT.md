# ChatGPT Task Scheduler Prototype

## System Requirements

Build a job scheduler with an MCP (Model Context Protocol) interface:
- Users schedule tasks for future execution via MCP tool calls
- A background watcher scans for due jobs and pushes them to a queue
- Workers pull jobs from the queue and execute them
- Support task creation, listing, status checking, and cancellation
- Tool naming follows namespace + action verb pattern (e.g., `task.create`)

### Architecture

```
User → MCP Tool Call → Job Scheduler API → DB
                                            ↓
                              Watcher (scans DB) → Queue → Worker (executes)
```

## Design Questions

Answer these before you start coding:

1. **Watcher vs Cron:** Why separate the watcher from the worker? What problems does a single cron job that both scans and executes have?

   **Answer:** 單一 cron 同時做 scan + execute 會有三個問題：(1) long-running job 會卡住下一輪 scan，到期 job 無法被即時撿走；(2) scan 跟 execute 共享同一個 process 的 CPU / memory，互相搶資源；(3) 任一邊 crash 整條 pipeline 一起死。把 watcher 拆出來後，watcher 只跑輕量 query，worker 可以水平擴 N 個跑長任務；雙方獨立故障邊界。前端類比：等於 Server Component 跟 Client Component 分層，各自關心一件事。

2. **Queue Layer:** Why put a queue between the watcher and worker instead of having the watcher call the worker directly? What are the benefits?

   **Answer:** Queue 給出四個關鍵性質：(1) **Decoupling** — watcher 不需要知道 worker 在哪、有幾個、活著沒，只負責丟訊息；(2) **Back-pressure / buffering** — 尖峰時段 1000 個 job 同時 due，沒 queue 會直接打爆 worker，有 queue 可以自然削峰；(3) **水平擴展** — N 個 worker consume 同一個 queue 自動 load balance；(4) **At-least-once 語意** — worker 掛了 job 還在 queue，下一個 worker 可以接手。Production 通常用 SQS / Redis / RabbitMQ；這個 prototype 用 in-memory array 模擬。

3. **Time Bucket Partitioning:** Instead of `SELECT * WHERE scheduled_at <= now()`, why partition jobs by time bucket (e.g., hour)? What happens to query performance at 1M+ jobs without partitioning?

   **Answer:** 沒分區的話，`scheduled_at <= now()` 是一個範圍查詢，即使 `scheduled_at` 有 index，在 1M+ rows 也會做大範圍 index scan，每分鐘 watcher 都要付這個成本。加上 `time_bucket` 之後，查詢條件改成 `WHERE time_bucket <= ? AND status = 'pending' AND scheduled_at <= ?` — 配上 `(time_bucket, status)` 複合索引，DB 真正要掃的只有「過去 bucket 中還是 pending」這一小撮（過去的 job 絕大多數早就 `completed`，被 `status='pending'` 篩掉了），工作集從「全表」縮成「未消化的尾巴」。Catch-up 邊界：第一輪 watcher 把過去所有 pending 撿光後，後續每輪 tick 主要只看 current bucket，效能維持在 O(bucket size)。為什麼仍要 `time_bucket <= ?` 而不是純 `status='pending'`：保留 `time_bucket` 條件可以走 composite index 的左前綴；如果連時間都不過濾，未來 status 改成多值狀態機時（例如加 `delayed`、`retry-pending`），就會被迫做 status 單欄 index 或退化成 scan。

4. **Tool Naming:** Why `task.create` instead of `createTask`? How does naming convention affect LLM tool selection accuracy?

   **Answer:** `namespace.verb` 的命名先告訴 LLM「跟誰互動（task）」，再告訴它「做什麼（create）」。當多個 namespace 並存（task.*、calendar.*、email.*）時，LLM 在篩選 candidate tool 時可以先用 prefix 縮範圍、再選 verb，分類更乾淨、選錯機率更低。`createTask` 把動詞放前面，跟 `createUser`、`createEvent`、`createDraft` 在 token 空間離得很近，semantic 干擾比較大。此外 namespace 前綴跟 REST 的 noun-first 設計同源，命名一致也讓人類設計 prompt 時比較好記。

5. **Registry vs If-Else:** Why use a dictionary registry to route tool calls instead of if-else chains? What happens when you need to add the 20th tool?

   **Answer:** Registry 滿足 Open/Closed Principle — 加第 20 個 tool 是「dict 多一行」，不是「if-elif 串再加一個 branch」。具體好處：(1) **可測試** — registry 可以在測試裡被 monkey-patch / mock 單一 tool，if-elif 不行；(2) **Single source of truth** — tool name 跟 handler 對應在一個地方看完，不會散落在 dispatch function 各處；(3) **延展性** — 將來想做 middleware（logging / auth / rate limit）只要 wrap registry 的 value 就好。前端類比：React Router 用 routes config object 而不是在某個 `switch (path)` 寫 100 個 case，理由完全一致。（題外話：Node 版用 `@modelcontextprotocol/sdk` 的 `McpServer.registerTool()`，SDK 內部已經幫我們實作了 registry pattern，我們直接呼叫 API 即可。）

## Verification

Your prototype is a real MCP server. Test it with the MCP inspector — no Claude needed.

The commands below use the reference Node.js implementation in `scaffold-node/`. If you build your own (Challenge Track), substitute the equivalent commands for your stack — the inspector flow is the same.

### 1. Start the server (sanity check)

```bash
cd scaffold-node
pnpm install                            # first time
pnpm rebuild better-sqlite3 esbuild     # first time — native binding
pnpm dev
```

The process should hang waiting on stdin (it's a stdio MCP server — that's correct). Ctrl+C to stop. If you see an error or crash, fix that first.

### 2. Run the MCP inspector

```bash
pnpm inspector
# under the hood: npx -y @modelcontextprotocol/inspector tsx src/server.ts
```

This opens a browser GUI (usually `http://localhost:5173`).

Steps in the GUI:

1. Click **Connect** → should show 4 tools: `task.create`, `task.list`, `task.status`, `task.cancel`
2. **task.create** → fill `description="Summarize tech news"`, `scheduled_at="2025-01-01T00:00:00Z"` (past time so watcher picks it up immediately) → **Run Tool** → response should include `{"job_id": 1, "status": "pending", ...}`
3. Wait ~10 seconds, then **task.status** → `job_id: 1` → status should now be `"completed"`
4. **task.create** with future time `"2099-12-31T00:00:00Z"` → get `job_id: 2`
5. **task.cancel** → `job_id: 2` → status `"cancelled"`
6. **task.list** → see all your jobs

### 3. (Optional) Connect to Claude Desktop / Claude Code

Once the inspector tests pass, the server is ready to wire into Claude.

**⚠️ Do not spawn `pnpm` as the MCP command** — pnpm writes its `> script-name` banner to **stdout**, which corrupts the MCP JSON-RPC channel. Spawn `tsx` (or the compiled `node` binary) directly.

**Claude Desktop**: edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) and add (use absolute paths):

```json
{
  "mcpServers": {
    "task-scheduler": {
      "command": "/absolute/path/to/scaffold-node/node_modules/.bin/tsx",
      "args": ["/absolute/path/to/scaffold-node/src/server.ts"],
      "cwd": "/absolute/path/to/scaffold-node"
    }
  }
}
```

Restart Claude Desktop fully. The 🔨 icon in the chat input should show 4 tools.

**Claude Code**: edit `~/.claude.json` (top-level `mcpServers` for user scope) with the same block, or run `claude mcp add` from inside `scaffold-node/`.

Then chat:
> "Schedule a task to review PR #123 tomorrow at 9am."
> → Claude calls `task.create` → returns job_id
> "What's the status of that task?"
> → Claude calls `task.status`

## Suggested Tech Stack

Node.js + TypeScript + `@modelcontextprotocol/sdk` + Zod + better-sqlite3 (used in `scaffold-node/`). Any language with an MCP SDK also works for the Challenge Track.
