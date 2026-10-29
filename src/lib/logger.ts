import { tryCreateServiceClient } from '@/lib/supabase/server'

/**
 * Pencatat error terpusat (server only).
 * Tiap error: tetap ke console (docker logs), disimpan ke tabel error_logs,
 * dan dikirim ke Telegram (di-throttle). Tidak pernah melempar error —
 * kalau penyimpanan gagal, cukup console saja.
 */

export type LogLevel = 'error' | 'warn'
export type LogSource = 'server' | 'client'

export interface LogEntry {
  level?: LogLevel
  source?: LogSource
  context: string
  message: string
  stack?: string | null
  meta?: Record<string, unknown> | null
  url?: string | null
  user_agent?: string | null
  ip?: string | null
}

const MAX_MESSAGE = 2000
const MAX_STACK = 8000
const TELEGRAM_THROTTLE_MS = Number(process.env.ERROR_TELEGRAM_THROTTLE_MS) || 10 * 60 * 1000

const cut = (s: string | null | undefined, max: number) =>
  s ? (s.length > max ? s.slice(0, max) + '…' : s) : null

/** Ambil message + stack dari nilai apa pun yang di-throw. */
export function describeError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message || err.name, stack: err.stack }
  if (typeof err === 'string') return { message: err }
  try {
    return { message: JSON.stringify(err) }
  } catch {
    return { message: String(err) }
  }
}

/** Catat error dari kode server: logError('payment.create', err, { order_id }) */
export async function logError(context: string, err: unknown, meta?: Record<string, unknown>) {
  const { message, stack } = describeError(err)
  await writeLog({ level: 'error', source: 'server', context, message, stack, meta })
}

export async function logWarn(context: string, message: string, meta?: Record<string, unknown>) {
  await writeLog({ level: 'warn', source: 'server', context, message, meta })
}

export async function writeLog(entry: LogEntry) {
  const row = {
    level: entry.level || 'error',
    source: entry.source || 'server',
    context: cut(entry.context, 100) || 'unknown',
    message: cut(entry.message, MAX_MESSAGE) || '(tanpa pesan)',
    stack: cut(entry.stack, MAX_STACK),
    meta: entry.meta ?? null,
    url: cut(entry.url, 500),
    user_agent: cut(entry.user_agent, 300),
    ip: cut(entry.ip, 45),
  }

  const line = `[${row.level}] [${row.source}:${row.context}] ${row.message}`
  if (row.level === 'warn') console.warn(line, row.meta ?? '')
  else console.error(line, row.meta ?? '', row.stack ? `\n${row.stack}` : '')

  await Promise.all([saveToDb(row), notifyTelegram(row)])
}

async function saveToDb(row: Record<string, unknown>) {
  try {
    const sb = await tryCreateServiceClient()
    if ('error' in sb) return
    const { error } = await sb.client.from('error_logs').insert(row)
    if (error) console.error('[logger] gagal simpan error_logs:', error.message)
  } catch (err) {
    console.error('[logger] gagal simpan error_logs:', err)
  }
}

// Throttle per jenis error (source + context + awal pesan) supaya Telegram tidak spam
const lastSent = new Map<string, { at: number; suppressed: number }>()

async function notifyTelegram(row: { level: string; source: string; context: string; message: string; url: string | null }) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId || row.level !== 'error') return

  const key = `${row.source}|${row.context}|${row.message.slice(0, 80)}`
  const now = Date.now()
  const prev = lastSent.get(key)
  if (prev && now - prev.at < TELEGRAM_THROTTLE_MS) {
    prev.suppressed++
    return
  }
  lastSent.set(key, { at: now, suppressed: 0 })
  if (lastSent.size > 500) lastSent.delete(lastSent.keys().next().value!)

  const text = [
    `🚨 Cafe error (${row.source})`,
    `Context: ${row.context}`,
    row.url ? `URL: ${row.url}` : null,
    prev?.suppressed ? `(+${prev.suppressed} error serupa sejak notif terakhir)` : null,
    '',
    row.message.slice(0, 1500),
  ].filter(l => l !== null).join('\n')

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) console.error('[logger] Telegram gagal:', res.status)
  } catch (err) {
    console.error('[logger] Telegram gagal:', (err as Error)?.message || err)
  }
}
