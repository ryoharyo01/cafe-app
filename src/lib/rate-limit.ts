/**
 * Rate limiter in-memory untuk API publik, dipanggil dari proxy.ts.
 * Fixed window per IP per aturan. Cukup karena app jalan di satu container;
 * kalau nanti di-scale ke banyak instance, pindahkan counter ke Redis/DB.
 *
 * Batas sengaja longgar: pelanggan satu cafe biasanya keluar lewat satu IP
 * Wi-Fi yang sama, dan halaman status pesanan polling tiap 4 detik.
 */

export interface RateRule {
  name: string
  limit: number
  windowMs: number
}

const MINUTE = 60_000

// Urutan penting: aturan pertama yang cocok yang dipakai
const RULES: { method?: string; pattern: RegExp; rule: RateRule | null }[] = [
  // Webhook Midtrans: jangan dibatasi (retry dari server Midtrans, sudah diverifikasi signature)
  { method: 'POST', pattern: /^\/api\/payment\/webhook$/, rule: null },
  // Rute staf sudah dijaga login di proxy
  { pattern: /^\/api\/(admin|pos)\//, rule: null },
  { method: 'PATCH', pattern: /^\/api\/orders\/[^/]+\/status$/, rule: null },

  { method: 'POST', pattern: /^\/api\/auth\/login$/, rule: { name: 'login', limit: 20, windowMs: MINUTE } },
  { method: 'POST', pattern: /^\/api\/ai\/chat$/, rule: { name: 'ai-chat', limit: 20, windowMs: MINUTE } },
  { method: 'POST', pattern: /^\/api\/orders$/, rule: { name: 'order-create', limit: 20, windowMs: MINUTE } },
  { method: 'POST', pattern: /^\/api\/payment\/(create|demo)$/, rule: { name: 'payment', limit: 20, windowMs: MINUTE } },
  { method: 'POST', pattern: /^\/api\/log$/, rule: { name: 'client-log', limit: 20, windowMs: MINUTE } },
  { method: 'GET', pattern: /^\/api\//, rule: { name: 'read', limit: 300, windowMs: MINUTE } },
  { pattern: /^\/api\//, rule: { name: 'default', limit: 60, windowMs: MINUTE } },
]

export function ruleFor(method: string, path: string): RateRule | null {
  for (const r of RULES) {
    if (r.method && r.method !== method) continue
    if (r.pattern.test(path)) return r.rule
  }
  return null
}

const buckets = new Map<string, { count: number; resetAt: number }>()

export interface RateResult {
  ok: boolean
  limit: number
  remaining: number
  resetAt: number
  /** true hanya pada request pertama yang ditolak di window ini (buat logging sekali saja) */
  firstBlocked: boolean
}

export function hit(rule: RateRule, ip: string, now = Date.now()): RateResult {
  if (buckets.size > 10_000) sweep(now)

  const key = `${rule.name}:${ip}`
  let b = buckets.get(key)
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + rule.windowMs }
    buckets.set(key, b)
  }
  b.count++

  return {
    ok: b.count <= rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - b.count),
    resetAt: b.resetAt,
    firstBlocked: b.count === rule.limit + 1,
  }
}

function sweep(now: number) {
  for (const [key, b] of buckets) if (now >= b.resetAt) buckets.delete(key)
  if (buckets.size > 10_000) buckets.clear()
}

export function clientIp(headers: Headers) {
  const forwardedFor = headers.get('x-forwarded-for')
  return forwardedFor ? forwardedFor.split(',')[0].trim() : (headers.get('x-real-ip') || 'unknown')
}
