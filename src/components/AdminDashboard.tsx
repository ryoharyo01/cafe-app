'use client'

import { useEffect, useRef, useState } from 'react'
import { formatRupiah } from '@/lib/utils'
import { usePolling } from '@/lib/use-polling'
import { Loader2, TrendingUp, TrendingDown, Table2, BarChart3 } from 'lucide-react'

type Group = 'day' | 'week' | 'month'
type Preset = 'today' | '7d' | '30d' | 'month' | 'year' | 'custom'

interface Summary { revenue: number; orders: number; items_sold: number; avg_order: number }
interface DashboardData {
  summary: Summary
  previous: Summary
  series: { key: string; label: string; revenue: number; orders: number }[]
  top_menu: { name: string; quantity: number; revenue: number }[]
  by_payment: Record<string, { orders: number; revenue: number }>
  by_source: { table: { orders: number; revenue: number }; walkin: { orders: number; revenue: number } }
}

// Single-series bar color; validated against the stone-900 surface
const BAR = '#d97706'
const DAY_MS = 24 * 60 * 60 * 1000

const PRESETS: { key: Preset; label: string; group: Group }[] = [
  { key: 'today', label: 'Hari ini', group: 'day' },
  { key: '7d', label: '7 hari', group: 'day' },
  { key: '30d', label: '30 hari', group: 'day' },
  { key: 'month', label: 'Bulan ini', group: 'day' },
  { key: 'year', label: 'Tahun ini', group: 'month' },
  { key: 'custom', label: 'Custom', group: 'day' },
]
const GROUPS: { key: Group; label: string }[] = [
  { key: 'day', label: 'Harian' },
  { key: 'week', label: 'Mingguan' },
  { key: 'month', label: 'Bulanan' },
]
const PAYMENT_LABEL: Record<string, string> = { cash: 'Tunai', qris: 'QRIS', lainnya: 'Lainnya' }

// Today's date in WIB as YYYY-MM-DD
function todayWib() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function shiftDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

function presetRange(p: Preset): { from: string; to: string } {
  const t = todayWib()
  if (p === '7d') return { from: shiftDate(t, -6), to: t }
  if (p === '30d') return { from: shiftDate(t, -29), to: t }
  if (p === 'month') return { from: `${t.slice(0, 8)}01`, to: t }
  if (p === 'year') return { from: `${t.slice(0, 4)}-01-01`, to: t }
  return { from: t, to: t }
}

function compactRupiah(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
  if (n >= 1_000) return `${Math.round(n / 1_000)} rb`
  return String(n)
}

// Round the axis max up to a 1/2/5 step so gridlines land on readable numbers
function niceMax(v: number) {
  if (v <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(v))
  const step = [1, 2, 5, 10].find(s => s * pow >= v) || 10
  return step * pow
}

export default function AdminDashboard() {
  const [preset, setPreset] = useState<Preset>('7d')
  const [range, setRange] = useState(presetRange('7d'))
  const [group, setGroup] = useState<Group>('day')
  const [payment, setPayment] = useState('all')
  const [source, setSource] = useState('all')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Background refresh: bumping tick reloads silently (no loading state)
  const [tick, setTick] = useState(0)
  const silentRef = useRef(false)
  usePolling(() => {
    silentRef.current = true
    setTick(t => t + 1)
  }, 5000)

  useEffect(() => {
    let cancelled = false
    const silent = silentRef.current
    silentRef.current = false
    async function load() {
      if (!silent) setLoading(true)
      setError('')
      try {
        const qs = new URLSearchParams({ ...range, group, payment, source })
        const res = await fetch(`/api/admin/dashboard?${qs}`, { cache: 'no-store' })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) setError(json.error || 'Gagal memuat dashboard')
        else setData(json)
      } catch {
        if (!cancelled) setError('Gagal memuat dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [range, group, payment, source, tick])

  function pickPreset(p: Preset) {
    setPreset(p)
    if (p !== 'custom') setRange(presetRange(p))
    setGroup(PRESETS.find(x => x.key === p)!.group)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Dashboard Penjualan</h2>

      {/* Filters — one row above the charts */}
      <div className="bg-stone-900 rounded-2xl p-4 mb-4 flex flex-wrap items-end gap-4">
        <div>
          <p className="text-stone-400 text-xs mb-1">Periode</p>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => pickPreset(p.key)}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  preset === p.key ? 'bg-amber-500 text-stone-950 font-semibold' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {preset === 'custom' && (
          <div className="flex items-end gap-2">
            <label className="text-xs text-stone-400">
              Dari
              <input
                type="date"
                value={range.from}
                max={range.to}
                onChange={e => e.target.value && setRange(r => ({ ...r, from: e.target.value }))}
                className="block mt-1 bg-stone-800 rounded-lg px-2 py-1.5 text-sm text-stone-100 [color-scheme:dark]"
              />
            </label>
            <label className="text-xs text-stone-400">
              Sampai
              <input
                type="date"
                value={range.to}
                min={range.from}
                max={todayWib()}
                onChange={e => e.target.value && setRange(r => ({ ...r, to: e.target.value }))}
                className="block mt-1 bg-stone-800 rounded-lg px-2 py-1.5 text-sm text-stone-100 [color-scheme:dark]"
              />
            </label>
          </div>
        )}

        <Segmented label="Pendapatan per" value={group} onChange={v => setGroup(v as Group)} options={GROUPS} />
        <Select
          label="Pembayaran"
          value={payment}
          onChange={setPayment}
          options={[{ key: 'all', label: 'Semua' }, { key: 'cash', label: 'Tunai' }, { key: 'qris', label: 'QRIS' }]}
        />
        <Select
          label="Sumber"
          value={source}
          onChange={setSource}
          options={[{ key: 'all', label: 'Semua' }, { key: 'table', label: 'Meja (QR)' }, { key: 'walkin', label: 'Walk-in (Kasir)' }]}
        />
        {loading && <Loader2 className="w-5 h-5 animate-spin text-amber-500 mb-2" />}
      </div>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      {data && (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Kpi label="Pendapatan" value={formatRupiah(data.summary.revenue)} now={data.summary.revenue} prev={data.previous.revenue} />
            <Kpi label="Pesanan" value={data.summary.orders.toLocaleString('id-ID')} now={data.summary.orders} prev={data.previous.orders} />
            <Kpi label="Item terjual" value={data.summary.items_sold.toLocaleString('id-ID')} now={data.summary.items_sold} prev={data.previous.items_sold} />
            <Kpi label="Rata-rata / pesanan" value={formatRupiah(data.summary.avg_order)} now={data.summary.avg_order} prev={data.previous.avg_order} />
          </div>

          <RevenueChart series={data.series} group={group} />

          <div className="grid lg:grid-cols-3 gap-4 mt-4">
            <div className="lg:col-span-2">
              <TopMenu items={data.top_menu} />
            </div>
            <div className="space-y-4">
              <Breakdown
                title="Metode pembayaran"
                rows={Object.entries(data.by_payment).map(([k, v]) => ({ label: PAYMENT_LABEL[k] || k, ...v }))}
              />
              <Breakdown
                title="Sumber pesanan"
                rows={[
                  { label: 'Meja (QR)', ...data.by_source.table },
                  { label: 'Walk-in (Kasir)', ...data.by_source.walkin },
                ]}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Segmented({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { key: string; label: string }[]
}) {
  return (
    <div>
      {label && <p className="text-stone-400 text-xs mb-1">{label}</p>}
      <div className="flex bg-stone-800 rounded-lg p-0.5">
        {options.map(o => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`px-3 py-1 rounded-md text-sm ${value === o.key ? 'bg-stone-950 text-amber-400 font-semibold' : 'text-stone-300'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { key: string; label: string }[]
}) {
  return (
    <label className="text-xs text-stone-400">
      {label}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="block mt-1 bg-stone-800 rounded-lg px-2 py-1.5 text-sm text-stone-100"
      >
        {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    </label>
  )
}

function Kpi({ label, value, now, prev }: { label: string; value: string; now: number; prev: number }) {
  const pct = prev > 0 ? Math.round(((now - prev) / prev) * 100) : null
  const up = pct != null && pct >= 0
  return (
    <div className="bg-stone-900 rounded-2xl p-5">
      <p className="text-stone-400 text-sm">{label}</p>
      <p className="text-2xl md:text-3xl font-bold text-stone-100 mt-1">{value}</p>
      <p className="text-xs mt-2 text-stone-400 flex items-center gap-1">
        {pct == null ? (
          'Tidak ada data periode sebelumnya'
        ) : (
          <>
            {up ? <TrendingUp className="w-3.5 h-3.5 text-green-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
            <span className={up ? 'text-green-500' : 'text-red-400'}>{up ? '+' : ''}{pct}%</span>
            vs periode sebelumnya
          </>
        )}
      </p>
    </div>
  )
}

function RevenueChart({ series, group }: { series: DashboardData['series']; group: Group }) {
  const [hover, setHover] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)
  const max = niceMax(Math.max(0, ...series.map(s => s.revenue)))
  const ticks = [max, max / 2, 0]
  const labelEvery = Math.ceil(series.length / 10)
  const title = group === 'day' ? 'Pendapatan harian' : group === 'week' ? 'Pendapatan mingguan' : 'Pendapatan bulanan'
  const total = series.reduce((s, x) => s + x.revenue, 0)

  return (
    <div className="bg-stone-900 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{title}</h3>
        <button
          onClick={() => setAsTable(t => !t)}
          className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-200"
        >
          {asTable ? <><BarChart3 className="w-4 h-4" /> Grafik</> : <><Table2 className="w-4 h-4" /> Tabel</>}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-stone-400 text-left sticky top-0 bg-stone-900">
              <tr><th className="py-1">Periode</th><th className="text-right">Pesanan</th><th className="text-right">Pendapatan</th></tr>
            </thead>
            <tbody>
              {series.map(s => (
                <tr key={s.key} className="border-t border-stone-800">
                  <td className="py-1.5">{s.label}</td>
                  <td className="text-right">{s.orders}</td>
                  <td className="text-right">{formatRupiah(s.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : total === 0 ? (
        <p className="text-stone-500 text-center py-16">Belum ada penjualan di periode ini</p>
      ) : (
        <div className="flex">
          {/* Y axis */}
          <div className="relative h-56 w-14 shrink-0 text-[11px] text-stone-500">
            {ticks.map((t, i) => (
              <span key={i} className="absolute right-2 -translate-y-1/2" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
                {compactRupiah(t)}
              </span>
            ))}
          </div>
          <div className="flex-1 overflow-x-auto">
            <div style={{ minWidth: series.length * 10 }}>
              <div className="relative h-56">
                {ticks.map((_, i) => (
                  <div key={i} className="absolute left-0 right-0 border-t border-stone-800" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
                ))}
                <div className="absolute inset-0 flex items-end gap-[2px]">
                  {series.map((s, i) => (
                    <button
                      key={s.key}
                      type="button"
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                      aria-label={`${s.label}: ${formatRupiah(s.revenue)}, ${s.orders} pesanan`}
                      className="relative flex-1 h-full flex items-end group"
                    >
                      <span
                        className="w-full rounded-t-[4px] transition-opacity"
                        style={{
                          height: `${(s.revenue / max) * 100}%`,
                          minHeight: s.revenue > 0 ? 2 : 0,
                          background: BAR,
                          opacity: hover == null || hover === i ? 1 : 0.45,
                        }}
                      />
                      {hover === i && (
                        <span
                          className={`absolute bottom-full mb-2 z-10 whitespace-nowrap rounded-lg bg-stone-800 border border-stone-700 px-3 py-2 text-left text-xs shadow-lg ${
                            i > series.length / 2 ? 'right-0' : 'left-0'
                          }`}
                        >
                          <span className="block text-stone-400">{s.label}</span>
                          <span className="block font-semibold text-stone-100">{formatRupiah(s.revenue)}</span>
                          <span className="block text-stone-400">{s.orders} pesanan</span>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              {/* X labels, thinned so they never collide */}
              <div className="flex gap-[2px] mt-2 text-[11px] text-stone-500">
                {series.map((s, i) => (
                  <span key={s.key} className="flex-1 text-center whitespace-nowrap overflow-visible">
                    {i % labelEvery === 0 ? s.label : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TopMenu({ items }: { items: DashboardData['top_menu'] }) {
  const [sortBy, setSortBy] = useState<'quantity' | 'revenue'>('quantity')
  const top = [...items].sort((a, b) => b[sortBy] - a[sortBy]).slice(0, 10)
  const max = Math.max(1, ...top.map(m => m[sortBy]))

  return (
    <div className="bg-stone-900 rounded-2xl p-5 h-full">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="font-semibold">Menu terlaris</h3>
        <Segmented
          label=""
          value={sortBy}
          onChange={v => setSortBy(v as 'quantity' | 'revenue')}
          options={[{ key: 'quantity', label: 'Jumlah' }, { key: 'revenue', label: 'Pendapatan' }]}
        />
      </div>
      {top.length === 0 ? (
        <p className="text-stone-500 text-center py-8">Belum ada menu terjual</p>
      ) : (
        <ol className="space-y-3">
          {top.map((m, i) => (
            <li key={`${i}-${m.name}`} className="text-sm">
              <div className="flex justify-between gap-3 mb-1">
                <span className="truncate"><span className="text-stone-500 mr-2">{i + 1}.</span>{m.name}</span>
                <span className="text-stone-300 whitespace-nowrap">
                  {sortBy === 'quantity'
                    ? <>{m.quantity.toLocaleString('id-ID')} terjual <span className="text-stone-500">· {formatRupiah(m.revenue)}</span></>
                    : <>{formatRupiah(m.revenue)} <span className="text-stone-500">· {m.quantity} terjual</span></>}
                </span>
              </div>
              <div className="h-2 rounded-full bg-stone-800">
                <div className="h-full rounded-full" style={{ width: `${(m[sortBy] / max) * 100}%`, background: BAR }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; orders: number; revenue: number }[] }) {
  const total = rows.reduce((s, r) => s + r.revenue, 0)
  return (
    <div className="bg-stone-900 rounded-2xl p-5">
      <h3 className="font-semibold mb-3">{title}</h3>
      {total === 0 ? (
        <p className="text-stone-500 text-sm">Belum ada data</p>
      ) : (
        <ul className="space-y-3">
          {rows.map(r => {
            const pct = Math.round((r.revenue / total) * 100)
            return (
              <li key={r.label} className="text-sm">
                <div className="flex justify-between mb-1">
                  <span>{r.label}</span>
                  <span className="text-stone-300">{pct}% <span className="text-stone-500">· {r.orders} pesanan</span></span>
                </div>
                <div className="h-2 rounded-full bg-stone-800">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BAR }} />
                </div>
                <p className="text-stone-500 text-xs mt-1">{formatRupiah(r.revenue)}</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
