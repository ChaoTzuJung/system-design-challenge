# ChatGPT Task Scheduler — Node.js / TypeScript 版

Challenge Track 實作，用 Node.js + TypeScript + Zod + better-sqlite3。

行為等同上層 `../scaffold/` 的 Python 版：stdio MCP server 暴露 4 個 tool，watcher 每 10 秒掃 due jobs、worker 從 in-memory queue 拉出來執行。

## 前置條件

- Node.js 18+（`node -v` 確認）
- pnpm（必用，不要用 npm/yarn）
- 第一次跑 inspector 會需要網路下載 `@modelcontextprotocol/inspector`

## 安裝

```bash
pnpm install
```

第一次裝完若 better-sqlite3 native binding 沒編譯（pnpm 預設擋第三方 build script），跑：

```bash
pnpm rebuild better-sqlite3 esbuild
```

（`package.json` 已透過 `pnpm.onlyBuiltDependencies` 把這兩個 package 加入白名單，乾淨環境 install 時會自動跑 build。）

## 跑

```bash
# Sanity check — process 應該 hang 在 stdin（正常），Ctrl+C 結束
pnpm dev

# MCP Inspector — 開 http://localhost:5173
pnpm inspector

# TypeScript 型別檢查
pnpm typecheck
```

## 驗證流程

依 `../PROMPT.md` Verification section：

1. `pnpm inspector` → 點 **Connect** → 應該看到 4 個 tool（`task.create` / `task.list` / `task.status` / `task.cancel`）
2. `task.create` description="Summarize tech news" scheduled_at="2025-01-01T00:00:00Z" → 拿 `job_id: 1`
3. 等約 10 秒 → `task.status` job_id=1 → 應該變 `"completed"`
4. `task.create` scheduled_at="2099-12-31T00:00:00Z" → `job_id: 2`
5. `task.cancel` job_id=2 → `"cancelled"`
6. `task.list` → 看到全部

跑壞了直接 `rm chatgpt_task.db` 重來。

## 架構說明

```
User → MCP Tool Call → handlers.ts → SQLite (jobs table)
                                       ↑
                            scheduler.ts (watcher every 10s)
                                       ↓
                            in-memory queue → worker (async loop)
```

- `src/db.ts` — SQLite schema：`jobs` table + `(time_bucket, status)` 複合索引
- `src/scheduler.ts` — `getTimeBucket()` / `findDueJobs()` / watcher + worker loop
- `src/handlers.ts` — 4 個 tool 的純業務邏輯
- `src/server.ts` — MCP server entry，用 `McpServer.registerTool()` 註冊 4 個 tool

## ⚠️ 接 MCP client 時不要走 pnpm

pnpm 跑 script 時會把 `> scaffold-node@1.0.0 dev` 這類 banner 印到 **stdout**，會污染 MCP 的 JSON-RPC 通道。`pnpm dev` 只適合 sanity check（看 server 啟不啟得來）；要接 Claude Desktop / Claude Code / 其他 MCP client 時，**直接 spawn `tsx` 或編譯後的 node**：

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

`pnpm inspector` 沒這個問題，因為它走 `npx -y @modelcontextprotocol/inspector tsx src/server.ts`，inspector 直接 spawn tsx、沒 pnpm wrapper。

## 已知限制（prototype 規模可忽略）

- **跨小時 catch-up**：watcher 只掃當前小時 bucket，剛跨小時的 job 若被前一輪錯過會延後到下個 watcher tick。Production 要同時掃 current + previous bucket pending row。
- **單一 worker**：in-memory queue + 一個 worker async loop。水平擴 worker 要換成 SQS / Redis。
- **No race protection**：因為 better-sqlite3 同步 + Node 單 thread，沒有 race；但 watcher 撞上慢 query 會 block worker。Production 用 thread pool 或 `worker_threads`。
- **`console.log` 禁區**：stdio 是 MCP protocol channel，所有 debug log 必須走 `console.error`（stderr）。
