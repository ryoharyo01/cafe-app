'use client'

import { useEffect, useState, useRef } from 'react'
import { Table } from '@/lib/types'
import { QRCode } from 'react-qrcode-logo'
import { Printer, Loader2, Plus, Trash2, Check } from 'lucide-react'

function defaultBase() {
  if (typeof window === 'undefined') return 'http://localhost:3111'
  return `${window.location.protocol}//${window.location.host}`
}

export default function MasterQR() {
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [base, setBase] = useState(defaultBase())
  const [editingBase, setEditingBase] = useState(false)
  const [number, setNumber] = useState('')
  const [msg, setMsg] = useState('')
  const slotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/tables')
        const data = await res.json()
        setTables(data.tables || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function addTable() {
    const n = Number(number)
    if (!Number.isInteger(n) || n < 1) {
      setMsg('Nomor meja harus angka positif')
      return
    }
    if (tables.some(t => t.number === n)) {
      setMsg(`Meja ${n} sudah ada`)
      return
    }
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: n }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data.error || 'Gagal menambah meja')
        return
      }
      setNumber('')
      const r2 = await fetch('/api/admin/tables')
      const d2 = await r2.json()
      setTables(d2.tables || [])
    } finally {
      setSaving(false)
    }
  }

  async function remove(t: Table) {
    if (!confirm(`Hapus Meja ${t.number}? QR-nya jadi tidak bisa dipakai. Order lama di meja ini juga terhapus.`)) return
    const res = await fetch(`/api/admin/tables?id=${t.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      alert(d.error || 'Gagal menghapus meja')
      return
    }
    const r2 = await fetch('/api/admin/tables')
    const d2 = await r2.json()
    setTables(d2.tables || [])
  }

  // Print satu kartu QR saja: kartu dipindah ke slot khusus, sisanya
  // disembunyikan lewat class body.printing-one, lalu dipulihkan setelah print.
  function printOne(t: Table) {
    const card = document.getElementById(`qr-card-${t.id}`)
    const slot = slotRef.current
    if (!card || !slot) return

    const holder = document.createElement('div')
    holder.id = 'print-slot-holder'
    holder.appendChild(card)
    slot.appendChild(holder)

    document.body.classList.add('printing-one')

    const restore = () => {
      const back = document.getElementById('print-slot-holder')
      const grid = card.closest('.grid')
      if (back && grid) grid.appendChild(card)
      back?.remove()
      slot.innerHTML = ''
      document.body.classList.remove('printing-one')
      window.removeEventListener('afterprint', restore)
    }

    window.addEventListener('afterprint', restore)
    window.print()
    setTimeout(restore, 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
      </div>
    )
  }

  const urlFor = (t: Table) => `${base.replace(/\/$/, '')}/table/${t.qr_token}`

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-bold">Master QR ({tables.length} meja)</h2>
        <p className="text-stone-500 text-sm mt-1">
          Print per meja lewat tombol printer di tiap kartu. Ganti base URL kalau tunnel berubah.
        </p>
      </div>

      <div className="bg-stone-900 rounded-2xl p-4 mb-5 flex flex-wrap items-center gap-3">
        <span className="text-sm text-stone-400 shrink-0">Base URL:</span>
        {editingBase ? (
          <>
            <input
              value={base}
              onChange={e => setBase(e.target.value)}
              className="flex-1 min-w-64 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 focus:border-amber-500 outline-none text-sm"
            />
            <button
              onClick={() => setEditingBase(false)}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-amber-500 text-stone-950 text-sm font-semibold"
            >
              <Check className="w-3.5 h-3.5" /> Selesai
            </button>
          </>
        ) : (
          <>
            <code className="flex-1 min-w-64 px-3 py-2 rounded-xl bg-stone-800 text-stone-300 text-sm break-all">{base}</code>
            <button
              onClick={() => setEditingBase(true)}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-sm"
            >
              Ganti
            </button>
          </>
        )}
      </div>

      <div className="bg-stone-900 rounded-2xl p-4 mb-5 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm text-stone-400">Nomor Meja Baru</span>
          <input
            type="number"
            min="1"
            value={number}
            onChange={e => { setNumber(e.target.value); setMsg('') }}
            placeholder="16"
            className="w-32 mt-1 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 focus:border-amber-500 outline-none"
          />
        </label>
        <button
          onClick={addTable}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-stone-950 font-semibold hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Tambah Meja
        </button>
        {msg && <p className="text-red-400 text-sm">{msg}</p>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {tables.map(t => (
          <div key={t.id} id={`qr-card-${t.id}`} className="qr-card bg-stone-900 rounded-2xl p-4 text-center flex flex-col items-center">
            <p className="text-xl font-bold mb-1">Meja {t.number}</p>
            <div className="bg-white rounded-xl p-2 my-3">
              <QRCode value={urlFor(t)} size={140} quietZone={8} ecLevel="M" />
            </div>
            <p className="text-stone-500 text-[10px] break-all leading-relaxed">{urlFor(t)}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => printOne(t)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
              <button
                onClick={() => remove(t)}
                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"
                title="Hapus meja"
                aria-label={`Hapus meja ${t.number}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {tables.length === 0 && (
        <div className="text-center py-12 text-stone-500">Belum ada meja terdaftar</div>
      )}

      <div ref={slotRef} />

      <style jsx global>{`
        body.printing-one * { visibility: hidden !important; }
        body.printing-one #print-slot-holder,
        body.printing-one #print-slot-holder * { visibility: visible !important; }
        #print-slot-holder .qr-card {
          background: #fff !important;
          color: #000 !important;
          border: 1px solid #ddd;
          border-radius: 16px;
          padding: 24px;
        }
        #print-slot-holder .qr-card p { color: #000 !important; }
        #print-slot-holder .qr-card button { display: none !important; }
        @page { margin: 12mm; }
      `}</style>
    </div>
  )
}
