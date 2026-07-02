#!/usr/bin/env node

import express, { Request, Response, NextFunction } from 'express'
import fs from 'fs'
import path from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TokenUsage {
  input?: number
  output?: number
  total?: number
  cache_read?: number
  cache_write?: number
}

interface AIHookLog {
  id: string
  received_at: string
  provider: string
  model: string
  event: string
  session_id?: string
  user_id?: string
  tokens?: TokenUsage
  cost_usd?: number
  duration_ms?: number
  request_id?: string
  metadata?: Record<string, unknown>
  raw: unknown
}

// ─── Config ───────────────────────────────────────────────────────────────────

const app = express()
const PORT = process.env.PORT ?? 3000
const MAX_LOGS = 1000
const LOG_FILE = path.join(process.cwd(), 'logs', 'ai-hooks.json')

// ─── File persistence ─────────────────────────────────────────────────────────

function ensureLogDir(): void {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
}

function loadLogsFromFile(): AIHookLog[] {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const raw = fs.readFileSync(LOG_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as AIHookLog[]
    }
  } catch {
    console.error(`[WARN] Could not read ${LOG_FILE} — starting with empty log`)
  }
  return []
}

function saveLogsToFile(): void {
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8')
  } catch (e) {
    console.error('[WARN] Failed to persist logs:', e)
  }
}

// ─── In-memory store (initialised from file) ─────────────────────────────────

ensureLogDir()
const logs: AIHookLog[] = loadLogsFromFile()

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json())
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeClaudePayload(body: Record<string, unknown>): Partial<AIHookLog> {
  const usage = body.usage as Record<string, number> | undefined
  return {
    provider: 'claude',
    model: (body.model ?? body.stop_reason ?? 'unknown') as string,
    event: (body.type ?? 'message') as string,
    tokens: usage
      ? {
          input: usage.input_tokens,
          output: usage.output_tokens,
          cache_read: usage.cache_read_input_tokens,
          cache_write: usage.cache_creation_input_tokens,
          total: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
        }
      : undefined,
    request_id: body.id as string | undefined,
  }
}

function normalizeOpenAIPayload(body: Record<string, unknown>): Partial<AIHookLog> {
  const usage = body.usage as Record<string, number> | undefined
  return {
    provider: (body.provider as string) ?? 'openai',
    model: (body.model as string) ?? 'unknown',
    event: (body.object ?? 'completion') as string,
    tokens: usage
      ? {
          input: usage.prompt_tokens,
          output: usage.completion_tokens,
          total: usage.total_tokens,
        }
      : undefined,
    request_id: body.id as string | undefined,
  }
}

function normalizeOpenCodePayload(body: Record<string, unknown>): Partial<AIHookLog> {
  return {
    provider: 'opencode',
    model: (body.model as string) ?? 'unknown',
    event: (body.event as string) ?? 'completion',
    tokens: {
      input: body.input_tokens as number | undefined,
      output: body.output_tokens as number | undefined,
      total: body.total_tokens as number | undefined,
    },
    cost_usd: body.cost as number | undefined,
    duration_ms: body.duration_ms as number | undefined,
    session_id: body.session_id as string | undefined,
  }
}

function normalizeClaudeCodePayload(body: Record<string, unknown>): Partial<AIHookLog> {
  let event = 'session_start'
  if (body.stop_hook_active !== undefined) event = 'stop'
  else if (body.prompt !== undefined) event = 'prompt_submit'
  else if (typeof body.hook_event_name === 'string') event = body.hook_event_name.toLowerCase()

  return {
    provider: 'claudecode',
    model: (body.model as string | undefined) ?? 'claude-code',
    event,
    session_id: body.session_id as string | undefined,
    metadata: {
      ...(typeof body.prompt === 'string' ? { prompt_length: body.prompt.length } : {}),
      ...(typeof body.hook_event_name === 'string' ? { hook_event: body.hook_event_name } : {}),
      ...(typeof body.cwd === 'string' ? { cwd: body.cwd } : {}),
    },
  }
}

function detectAndNormalize(body: Record<string, unknown>): Partial<AIHookLog> {
  const provider = ((body.provider as string) ?? '').toLowerCase()

  if (provider === 'claudecode' || body.stop_hook_active !== undefined || typeof body.hook_event_name === 'string') {
    return normalizeClaudeCodePayload(body)
  }
  if (provider === 'claude' || body.stop_reason !== undefined || body.type === 'message') {
    return normalizeClaudePayload(body)
  }
  if (provider === 'opencode') {
    return normalizeOpenCodePayload(body)
  }
  if (provider === 'openai' || provider === 'codex' || body.object === 'chat.completion' || body.choices !== undefined) {
    return normalizeOpenAIPayload({ ...body, provider: provider || 'openai' })
  }

  return {
    provider: provider || 'unknown',
    model: (body.model as string) ?? 'unknown',
    event: (body.event as string) ?? 'unknown',
  }
}

function buildLog(body: Record<string, unknown>): AIHookLog {
  const normalized = detectAndNormalize(body)
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    received_at: new Date().toISOString(),
    provider: 'unknown',
    model: 'unknown',
    event: 'unknown',
    session_id: body.session_id as string | undefined,
    user_id: body.user_id as string | undefined,
    cost_usd: body.cost_usd as number | undefined,
    duration_ms: body.duration_ms as number | undefined,
    metadata: body.metadata as Record<string, unknown> | undefined,
    raw: body,
    ...normalized,
  }
}

function appendLog(log: AIHookLog): void {
  if (logs.length >= MAX_LOGS) logs.shift()
  logs.push(log)
  saveLogsToFile()
  printLog(log)
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.post('/api/hook', (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>
  if (!body || typeof body !== 'object') {
    res.status(400).json({ ok: false, error: 'Body must be JSON object' })
    return
  }
  const log = buildLog(body)
  appendLog(log)
  res.status(201).json({ ok: true, id: log.id })
})

app.post('/api/hook/:provider', (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>
  body.provider = req.params.provider
  const log = buildLog(body)
  appendLog(log)
  res.status(201).json({ ok: true, id: log.id })
})

app.get('/api/logs', (req: Request, res: Response) => {
  const { provider, model, limit = '50' } = req.query as Record<string, string>

  let result = [...logs].reverse()
  if (provider) result = result.filter((l) => l.provider === provider)
  if (model) result = result.filter((l) => l.model.includes(model))

  const n = Math.min(parseInt(limit, 10) || 50, 500)
  result = result.slice(0, n)

  res.json({ total: logs.length, returned: result.length, logs: result })
})

app.get('/api/stats', (_req: Request, res: Response) => {
  const map = new Map<
    string,
    {
      provider: string
      model: string
      calls: number
      total_input_tokens: number
      total_output_tokens: number
      total_tokens: number
      total_cost_usd: number
      total_duration_ms: number
    }
  >()

  for (const log of logs) {
    const key = `${log.provider}::${log.model}`
    if (!map.has(key)) {
      map.set(key, {
        provider: log.provider,
        model: log.model,
        calls: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_tokens: 0,
        total_cost_usd: 0,
        total_duration_ms: 0,
      })
    }
    const stat = map.get(key)!
    stat.calls++
    stat.total_input_tokens += log.tokens?.input ?? 0
    stat.total_output_tokens += log.tokens?.output ?? 0
    stat.total_tokens += log.tokens?.total ?? 0
    stat.total_cost_usd += log.cost_usd ?? 0
    stat.total_duration_ms += log.duration_ms ?? 0
  }

  const stats = [...map.values()].sort((a, b) => b.calls - a.calls)
  res.json({ providers: [...new Set(logs.map((l) => l.provider))], stats })
})

app.delete('/api/logs', (_req: Request, res: Response) => {
  const count = logs.length
  logs.length = 0
  saveLogsToFile()
  console.log(`[CLEAR] Cleared ${count} logs and wrote empty file`)
  res.json({ ok: true, cleared: count })
})

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    log_count: logs.length,
    log_file: LOG_FILE,
    uptime_s: Math.floor(process.uptime()),
  })
})

// ─── Console pretty-printer ───────────────────────────────────────────────────

function printLog(log: AIHookLog): void {
  const tokens = log.tokens
    ? `in=${log.tokens.input ?? '-'} out=${log.tokens.output ?? '-'} total=${log.tokens.total ?? '-'}`
    : 'tokens=n/a'
  const cost = log.cost_usd !== undefined ? ` cost=$${log.cost_usd.toFixed(6)}` : ''
  const dur = log.duration_ms !== undefined ? ` dur=${log.duration_ms}ms` : ''
  const session = log.session_id ? ` session=${log.session_id}` : ''
  console.log(
    `[HOOK] ${log.received_at} | ${log.provider.padEnd(10)} | ${log.model.padEnd(30)} | ${tokens}${cost}${dur}${session}`,
  )
}

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`AI Hook Web Service running on http://localhost:${PORT}`)
  console.log(`  Log file : ${LOG_FILE}  (${logs.length} existing entries loaded)`)
  console.log(`  POST /api/hook            — receive hook (auto-detect provider)`)
  console.log(`  POST /api/hook/:provider  — receive hook (explicit provider)`)
  console.log(`  GET  /api/logs            — list logs  (?provider= &model= &limit=)`)
  console.log(`  GET  /api/stats           — aggregate stats`)
  console.log(`  DELETE /api/logs          — clear logs`)
  console.log(`  GET  /health              — health check`)
})
