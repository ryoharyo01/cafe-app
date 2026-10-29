// Kirim error dari browser ke /api/log. Tidak pernah melempar error.
// Error yang sama hanya dikirim sekali per halaman supaya tidak membanjiri log.
const sent = new Set<string>()

// Noise browser yang tidak bisa ditindaklanjuti
const IGNORED = [/ResizeObserver loop/i, /^Script error\.?$/i, /Load failed$/i, /Failed to fetch$/i, /NetworkError/i]

export function reportError(context: string, err: unknown, meta?: Record<string, unknown>) {
  try {
    const message = err instanceof Error ? err.message || err.name : typeof err === 'string' ? err : JSON.stringify(err)
    if (!message || IGNORED.some(re => re.test(message))) return

    const key = `${context}|${message}`
    if (sent.has(key) || sent.size >= 20) return
    sent.add(key)

    const body = JSON.stringify({
      context,
      message: message.slice(0, 2000),
      stack: err instanceof Error ? err.stack?.slice(0, 8000) : undefined,
      meta,
      url: window.location.pathname + window.location.search,
    })

    if (navigator.sendBeacon?.(`/api/log`, new Blob([body], { type: 'application/json' }))) return
    fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
  } catch {
    /* jangan sampai pelaporan error bikin error baru */
  }
}
