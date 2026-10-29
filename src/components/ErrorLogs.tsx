'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Loader2, RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react'

interface ErrorLog {
  id: number
  created_at: string
  level: 'error' | 'warn'
  source: 'server' | 'client'
  context: string
  message: string
  stack: string | null
  meta: Record<string, unknown> | null
  url: string | null
  user_agent: string | null
  ip: string | null
}

export default function ErrorLogs() {
  const [logs, setLogs] = useState<ErrorLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [source, setSource] = useState('all')
  const [level, setLevel] = useState('all')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams()
      if (source !== 'all') qs.set('source', source)
      if (level !== 'all') qs.set('level', level)
      if (search) qs.set('q', search)
      const res = await fetch(`/api/admin/error-logs?${qs}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Gagal memuat error log')
      else setLogs(json.logs || [])
    } catch {
      setError('Gagal memuat error log')
    } finally {
      setLoading(false)
    }
  }, [source, level, search])

  useEffect(() => { load() }, [load])

  async function clearAll() {
    if (!confirmClear) {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 4000)
      return
    }
    setConfirmClear(false)
    const res = await fetch('/api/admin/error-logs', { method: 'DELETE' })
    if (res.ok) {
      toast.success('Error log dikosongkan')
      setLogs([])
    } else {
      toast.error('Gagal menghapus error log')
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Error Log</h2>

      <div className="bg-stone-900 rounded-2xl p-4 mb-4 flex flex-wrap items-end gap-3">
        <Filter label="Sumber" value={source} onChange={setSource} options={[['all', 'Semua'], ['server', 'Server'], ['client', 'Browser']]} />
        <Filter label="Level" value={level} onChange={setLevel} options={[['all', 'Semua'], ['error', 'Error'], ['warn', 'Warning']]} />
        <form
          onSubmit={e => { e.preventDefault(); setSearch(q.trim()) }}
          className="flex-1 min-w-48"
        >
          <p className="text-stone-400 text-xs mb-1">Cari</p>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="pesan atau context, Enter untuk cari"
            className="w-full bg-stone-800 rounded-lg px-3 py-1.5 text-sm text-stone-100 placeholder:text-stone-500"
          />
        </form>
        <button onClick={load} className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 px-3 py-1.5 rounded-lg text-sm">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Muat ulang
        </button>
        <button
          onClick={clearAll}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${confirmClear ? 'bg-red-600 text-white' : 'bg-stone-800 hover:bg-stone-700 text-red-400'}`}
        >
          <Trash2 className="w-4 h-4" /> {confirmClear ? 'Yakin? Klik lagi' : 'Hapus semua'}
        </button>
      </div>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      <p className="text-stone-500 text-xs mb-2">
        Menampilkan {logs.length} log terbaru (maks 200). Log lebih dari 30 hari dihapus otomatis.
      </p>

      <div className="space-y-2">
        {logs.map(log => {
          const isOpen = open === log.id
          return (
            <div key={log.id} className="bg-stone-900 rounded-xl">
              <button onClick={() => setOpen(isOpen ? null : log.id)} className="w-full text-left p-4 flex gap-3 items-start">
                {isOpen ? <ChevronDown className="w-4 h-4 mt-1 shrink-0 text-stone-500" /> : <ChevronRight className="w-4 h-4 mt-1 shrink-0 text-stone-500" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${log.level === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {log.level}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${log.source === 'server' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                      {log.source === 'server' ? 'server' : 'browser'}
                    </span>
                    <span className="text-xs font-mono text-stone-300">{log.context}</span>
                    <span className="text-xs text-stone-500 ml-auto">{new Date(log.created_at).toLocaleString('id-ID')}</span>
                  </div>
                  <p className={`text-sm text-stone-200 break-words ${isOpen ? '' : 'line-clamp-2'}`}>{log.message}</p>
                </div>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pl-11 space-y-2 text-xs">
                  {log.url && <Detail label="URL" value={log.url} />}
                  {log.ip && <Detail label="IP" value={log.ip} />}
                  {log.user_agent && <Detail label="User agent" value={log.user_agent} />}
                  {log.meta && <Detail label="Meta" value={JSON.stringify(log.meta, null, 2)} pre />}
                  {log.stack && <Detail label="Stack" value={log.stack} pre />}
                </div>
              )}
            </div>
          )
        })}
        {!loading && logs.length === 0 && !error && (
          <p className="text-stone-500 text-center py-8">Belum ada error tercatat 🎉</p>
        )}
      </div>
    </div>
  )
}

function Filter({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][]
}) {
  return (
    <div>
      <p className="text-stone-400 text-xs mb-1">{label}</p>
      <div className="flex bg-stone-800 rounded-lg p-0.5">
        {options.map(([key, text]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`px-3 py-1 rounded-md text-sm ${value === key ? 'bg-amber-500 text-stone-950 font-semibold' : 'text-stone-300'}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

function Detail({ label, value, pre }: { label: string; value: string; pre?: boolean }) {
  return (
    <div>
      <p className="text-stone-500 mb-0.5">{label}</p>
      {pre
        ? <pre className="bg-stone-950 rounded-lg p-2 overflow-x-auto text-stone-300 whitespace-pre-wrap break-all">{value}</pre>
        : <p className="text-stone-300 break-all">{value}</p>}
    </div>
  )
}
