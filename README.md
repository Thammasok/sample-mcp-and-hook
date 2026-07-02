# Sample MCP Server + AI Hook Web Service

A sample **MCP (Model Context Protocol)** server and an **AI Hook Web Service** built with Node.js and TypeScript.

- **MCP Server** — exposes Tools, Resources, and Prompts to AI clients (Claude Desktop, Claude Code, etc.)
- **AI Hook Web Service** — HTTP service for logging AI usage events from Claude, Claude Code, OpenAI/Codex, OpenCode, and any other provider. Logs are kept in memory and persisted to a JSON file (no database required), with automatic cost estimation and a live web dashboard.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Setup](#setup)
- [MCP Server](#mcp-server)
  - [Running the MCP Server](#running-the-mcp-server)
  - [MCP Core Primitives](#mcp-core-primitives)
  - [Connect to Claude Desktop](#connect-to-claude-desktop)
- [AI Hook Web Service](#ai-hook-web-service)
  - [Running the Web Service](#running-the-web-service)
  - [Web Dashboard](#web-dashboard)
  - [Logging Claude Code Usage](#logging-claude-code-usage)
  - [Endpoints](#endpoints)
  - [Sending Hooks](#sending-hooks)
  - [Cost Estimation](#cost-estimation)
  - [Query Logs](#query-logs)
  - [View Stats](#view-stats)
- [Dependencies](#dependencies)

---

## Project Structure

```text
sample-mcp-and-hook/
├── src/
│   ├── main.ts          # MCP server entry point
│   ├── tools.ts         # MCP Tools (greet, add)
│   ├── resources.ts     # MCP Resources (config, user-profile)
│   ├── prompts.ts       # MCP Prompts (explain-code, review-code)
│   └── web-server.ts    # AI Hook Web Service entry point
├── public/
│   └── index.html       # Static web dashboard (AI Hook Monitor)
├── scripts/
│   └── ai-hook.sh       # Enriches Claude Code Stop hooks with token usage
├── .claude/
│   └── settings.json    # Claude Code hooks + AI_HOOK_URL
├── .mcp.json            # MCP server registration for Claude Code
├── logs/                # Persisted hook logs (ai-hooks.json, git-ignored)
├── dist/                # Compiled JavaScript (after build)
├── package.json
├── tsconfig.json
└── README.md
```

---

## Setup

**Prerequisites:** Node.js 18+ (and `jq` + `curl` for the Claude Code hooks)

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm build
```

---

## MCP Server

### Running the MCP Server

```bash
# Production
pnpm start:mcp

# Development (auto-rebuild on change)
pnpm dev
```

### MCP Core Primitives

| Primitive | Purpose | Direction | Example Use Case |
|-----------|---------|-----------|-----------------|
| **Tools** | Execute actions | AI → Server | Calculations, API calls |
| **Resources** | Provide data | Server → AI | Config, documents, user data |
| **Prompts** | Template messages | Server → AI | Standardized instructions |

#### Tools (`src/tools.ts`)

- `greet` — greets a user by name
- `add` — adds two numbers together

#### Resources (`src/resources.ts`)

- `config://app` — static application configuration
- `users://{userId}/profile` — dynamic user profile by ID

#### Prompts (`src/prompts.ts`)

- `explain-code` — prompt template for explaining code
- `review-code` — parameterized code review (language, focus area)

### Connect to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sample-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/sample-mcp-and-hook/dist/main.js"]
    }
  }
}
```

For **Claude Code**, the server is already registered in `.mcp.json` (relative path) and enabled in `.claude/settings.local.json` — no manual setup needed once you've run `pnpm build`.

---

## AI Hook Web Service

A lightweight HTTP service that receives AI usage events, logs them to the console, and **persists them to `logs/ai-hooks.json`**. Logs survive server restarts — the file is loaded automatically on startup. Cost is estimated automatically from token counts, and a live dashboard is served at the root URL. No database needed.

### Running the Web Service

```bash
# Production (build first)
pnpm build
pnpm start:hook

# Development (watches compiled output)
pnpm dev          # terminal 1 — recompile on change
pnpm dev:hook     # terminal 2 — restart server on change
```

Default port: **3000**. Override with the `PORT` environment variable:

```bash
PORT=4000 pnpm start:hook
```

> **Log file:** `logs/ai-hooks.json` (auto-created, already in `.gitignore`). Logs persist across restarts — the file is loaded on startup and rewritten after every hook received. Up to **1000** most-recent entries are retained in memory.

### Web Dashboard

Once the service is running, open the dashboard in your browser:

```
http://localhost:3000/
```

The static dashboard (`public/index.html`) visualizes logged events and aggregate stats per provider and model — color-coded by provider (Claude, Claude Code, OpenAI, OpenCode) and event type.

### Logging Claude Code Usage

This repo is preconfigured to log its own Claude Code usage to the web service.

**Step 1 — Start the web service** (keep it running in a separate terminal):

```bash
pnpm build
pnpm start:hook
# AI Hook Web Service running on http://localhost:3000
```

**Step 2 — No model config needed.** The hooks auto-detect your model at runtime:

- On **Stop** events, `scripts/ai-hook.sh` reads the session transcript and extracts the exact model plus real token usage (input, output, cache read/write).
- On **SessionStart** / **UserPromptSubmit** events (no token data available), an inline hook resolves the model from `.claude/settings.json` → `~/.claude/settings.json` → falls back to `"claude-code"`.

Whatever model you have configured in Claude Code is tracked automatically — no manual configuration required.

The hooks and endpoint are already wired up in `.claude/settings.json`:

```json
{
  "env": {
    "AI_HOOK_URL": "http://localhost:3000/api/hook/claudecode"
  },
  "hooks": {
    "SessionStart":     [ /* inline curl — logs session_start */ ],
    "UserPromptSubmit": [ /* inline curl — logs prompt_submit */ ],
    "Stop":             [ { "command": "bash scripts/ai-hook.sh" } ]
  }
}
```

**Step 3 — Open Claude Code** in this project directory as usual:

```bash
claude
```

Every session start, user prompt, and Claude response is logged automatically (asynchronously, so Claude Code is never blocked).

**Step 4 — View the logs** in the dashboard or via the API:

```bash
# All events from Claude Code
curl "http://localhost:3000/api/logs?provider=claudecode"

# Aggregated stats
curl http://localhost:3000/api/stats
```

> **Note:** The web service must be running on the configured port before Claude Code starts. If the service is down, hooks fail silently (Claude Code is not affected).

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Static web dashboard |
| `POST` | `/api/hook` | Receive a hook (provider auto-detected from body) |
| `POST` | `/api/hook/:provider` | Receive a hook with explicit provider name |
| `GET` | `/api/logs` | List logs (newest first) |
| `GET` | `/api/stats` | Aggregate stats grouped by provider + model |
| `DELETE` | `/api/logs` | Clear all logs |
| `GET` | `/health` | Health check (log count, log file path, uptime) |

---

### Sending Hooks

The service auto-detects the provider from the request body. You can also send hooks to `/api/hook/:provider` to set the provider explicitly.

#### Claude

```bash
curl -X POST http://localhost:3000/api/hook \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "claude",
    "model": "claude-sonnet-4-6",
    "type": "message",
    "id": "msg_01abc",
    "session_id": "sess_xyz",
    "usage": {
      "input_tokens": 1200,
      "output_tokens": 350,
      "cache_read_input_tokens": 800
    }
  }'
```

Console output (cost is auto-estimated from tokens):
```
[HOOK] 2026-07-02T06:00:00.000Z | claude     | claude-sonnet-4-6              | in=1200 out=350 total=1550 cost=$0.008850 session=sess_xyz
```

#### OpenAI / Codex

```bash
curl -X POST http://localhost:3000/api/hook \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4o",
    "object": "chat.completion",
    "id": "chatcmpl-abc",
    "cost_usd": 0.00014,
    "usage": {
      "prompt_tokens": 500,
      "completion_tokens": 200,
      "total_tokens": 700
    }
  }'
```

#### OpenCode

```bash
# Using explicit provider path
curl -X POST http://localhost:3000/api/hook/opencode \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet",
    "event": "completion",
    "input_tokens": 900,
    "output_tokens": 420,
    "total_tokens": 1320,
    "cost": 0.00031,
    "duration_ms": 1850,
    "session_id": "oc_sess_999"
  }'
```

#### Generic / Custom Provider

Any JSON body with a `provider` field works:

```bash
curl -X POST http://localhost:3000/api/hook \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "my-custom-llm",
    "model": "my-model-v1",
    "event": "inference",
    "input_tokens": 300,
    "output_tokens": 150,
    "cost_usd": 0.00005,
    "user_id": "user_42",
    "metadata": { "region": "ap-southeast-1" }
  }'
```

---

### Cost Estimation

When a hook does not include an explicit `cost_usd` (or `cost`), the service estimates it from token counts using built-in per-model pricing (input, output, cache-read, and cache-write rates per million tokens). Pricing is matched by substring against the model name, covering the Claude Opus/Sonnet/Haiku families (v3, v3.5, and v4).

- If an explicit cost is provided in the payload, it is used as-is.
- If no matching model pricing is found, cost is left unset.
- Estimated cost appears in the console output, the `cost_usd` log field, and the aggregated stats.

Adjust the `MODEL_PRICING` table in `src/web-server.ts` to add models or update rates.

---

### Query Logs

```bash
# All logs (newest first, default limit 50, max 500)
curl http://localhost:3000/api/logs

# Filter by provider (exact match)
curl "http://localhost:3000/api/logs?provider=claude"

# Filter by model name (partial match)
curl "http://localhost:3000/api/logs?model=sonnet"

# Combine filters and set limit
curl "http://localhost:3000/api/logs?provider=openai&limit=10"

# Clear all logs
curl -X DELETE http://localhost:3000/api/logs
```

**Response shape:**

```json
{
  "total": 42,
  "returned": 10,
  "logs": [
    {
      "id": "log_1782972333250_96p2e",
      "received_at": "2026-07-02T06:05:33.250Z",
      "provider": "claude",
      "model": "claude-sonnet-4-6",
      "event": "message",
      "session_id": "sess_xyz",
      "tokens": {
        "input": 1200,
        "output": 350,
        "cache_read": 800,
        "total": 1550
      },
      "cost_usd": 0.00885,
      "request_id": "msg_01abc",
      "raw": { "...": "original payload" }
    }
  ]
}
```

---

### View Stats

```bash
curl http://localhost:3000/api/stats
```

Stats are grouped by `provider` + `model` and sorted by call count (descending).

**Response shape:**

```json
{
  "providers": ["claude", "openai", "opencode"],
  "stats": [
    {
      "provider": "claude",
      "model": "claude-sonnet-4-6",
      "calls": 15,
      "total_input_tokens": 18000,
      "total_output_tokens": 5250,
      "total_tokens": 23250,
      "total_cache_read_tokens": 9600,
      "total_cache_write_tokens": 0,
      "total_cost_usd": 0.1328,
      "total_duration_ms": 0
    },
    {
      "provider": "openai",
      "model": "gpt-4o",
      "calls": 8,
      "total_input_tokens": 4000,
      "total_output_tokens": 1600,
      "total_tokens": 5600,
      "total_cache_read_tokens": 0,
      "total_cache_write_tokens": 0,
      "total_cost_usd": 0.00112,
      "total_duration_ms": 0
    }
  ]
}
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | Official MCP SDK |
| `express` | HTTP server for the AI Hook Web Service |
| `zod` | Schema validation for MCP tool inputs |

## Learn More

- [MCP Documentation](https://modelcontextprotocol.io/)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP SDK GitHub](https://github.com/modelcontextprotocol/sdk)

## License

ISC
