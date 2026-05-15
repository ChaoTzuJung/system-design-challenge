# ChatGPT Task Scheduler — Exercise

## How to Use

1. Read `PROMPT.md`
2. Answer the Design Questions (write your answers directly in `PROMPT.md`)
3. Build the prototype — either freestyle, or study/extend the reference implementation in `scaffold-node/`
4. Verify with the MCP inspector tests at the bottom of `PROMPT.md`
5. Bring your Design Questions answers to live session for discussion

## Tracks

**Challenge Track** — You decide the architecture, file structure, and implementation. Any language with an MCP SDK works. Read `PROMPT.md` to get started.

**Reference Track** — `scaffold-node/` is a complete reference implementation in **Node.js + TypeScript + Zod + better-sqlite3**, using the official `@modelcontextprotocol/sdk`. Read its source to compare against your own design choices, or use it as the starting point for the Bonus Challenges.

## Reference Implementation Quickstart

See `scaffold-node/README.md` for full setup, run, and verification details. TL;DR:

```bash
cd scaffold-node
pnpm install
pnpm rebuild better-sqlite3 esbuild   # first time only — native binding build
pnpm inspector                         # opens MCP inspector in your browser
```

Then walk through the GUI steps in `PROMPT.md` Verification section.

## Bonus Challenges

- Connect a real LLM to parse natural language task descriptions before calling `task.create`
- Add recurring job support (cron expressions)
- Add job chaining (Job A completes → triggers Job B)
- Add MCP `resources` support (e.g., expose job details as readable resources)
- Add MCP `prompts` support — `scaffold-node/` already ships a minimal `daily_review` prompt as a starting example
