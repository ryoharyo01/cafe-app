'use client'

import { useEffect, useRef, useState } from 'react'
import { formatRupiah } from '@/lib/utils'
import { Plus, Trash2, X, Loader2, Layers, ChevronDown, ChevronRight, Check, Info } from 'lucide-react'
import toast from 'react-hot-toast'

interface Opt {
  id: string
  group_id: string
  name: string
  price_add: number
  sort_order: number
}

interface Grp {
  id: string
  name: string
  is_required: boolean
  max_select: number
  options?: Opt[]
}

/**
 * Panel kelola grup modifier + opsi.
 * Dipasang di dalam tab Master Menu supaya admin cukup satu tempat.
 */
export default function ModifierGroupsPanel() {
  const [groups, setGroups] = useState<Grp[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  // id field yang sedang disimpan (buat spinner inline kecil)
  const [savingOpt, setSavingOpt] = useState<string | null>(null)
  // confirmed guard biar hapus grup nggak dobel-klik
  const [confirming, setConfirming] = useState<string | null>(null)

  const [form, setForm] = useState({ name: '', is_required: false, max_select: '1' })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [draft, setDraft] = useState<Record<string, { name: string; price_add: string }>>({})

  async function load() {
    const res = await fetch('/api/admin/modifier-groups')
    const data = await res.json()
    setGroups(data.groups || [])
  }

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [])

  // auto-batal konfirmasi hapus setelah 4 detik (anti tombol nyangkut)
  useEffect(() => {
    if (!confirming) return
    const t = setTimeout(() => setConfirming(null), 4000)
    return () => clearTimeout(t)
  }, [confirming])

  async function createGroup() {
    if (!form.name.trim()) {
      setError('Nama grup wajib diisi')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/modifier-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          is_required: form.is_required,
          max_select: Number(form.max_select) || 1,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Gagal menyimpan grup')
        toast.error(d.error || 'Gagal menyimpan grup')
        return
      }
      const d = await res.json()
      setForm({ name: '', is_required: false, max_select: '1' })
      setExpanded(p => ({ ...p, [d.group.id]: true }))
      toast.success(`Grup "${d.group.name}" dibuat`)
      await load()
    } catch {
      setError('Tidak bisa konek server')
      toast.error('Tidak bisa konek server')
    } finally {
      setSaving(false)
    }
  }

  async function patchGroup(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/admin/modifier-groups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    await load()
  }

  // Klik 1 = minta konfirmasi (tombol jadi merah "Hapus?"), klik 2 = benar-benar hapus
  async function deleteGroup(g: Grp) {
    if (confirming !== g.id) {
      setConfirming(g.id)
      return
    }
    setConfirming(null)
    const n = g.options?.length || 0
    const t = toast.loading(`Menghapus grup "${g.name}"...`)
    try {
      const res = await fetch(`/api/admin/modifier-groups/${g.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success(`Grup "${g.name}" dihapus${n ? ` (${n} opsi)` : ''}`, { id: t })
      await load()
    } catch {
      toast.error('Gagal menghapus grup', { id: t })
    }
  }

  async function addOption(gid: string) {
    const row = draft[gid]
    if (!row?.name?.trim()) {
      toast.error('Nama opsi wajib diisi')
      return
    }
    const t = toast.loading('Menambah opsi...')
    try {
      const res = await fetch(`/api/admin/modifier-groups/${gid}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: row.name.trim(), price_add: Number(row.price_add) || 0 }),
      })
      if (!res.ok) throw new Error()
      setDraft(p => ({ ...p, [gid]: { name: '', price_add: '0' } }))
      toast.success('Opsi ditambahkan', { id: t })
      await load()
    } catch {
      toast.error('Gagal menambah opsi', { id: t })
    }
  }

  async function patchOption(id: string, name: string, price: number) {
    setSavingOpt(id)
    try {
      const res = await fetch(`/api/admin/modifier-options/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price_add: price }),
      })
      if (!res.ok) throw new Error()
      toast.success('Opsi diperbarui')
      await load()
    } catch {
      toast.error('Gagal memperbarui opsi')
    } finally {
      setSavingOpt(null)
    }
  }

  async function deleteOption(id: string) {
    const t = toast.loading('Menghapus opsi...')
    try {
      const res = await fetch(`/api/admin/modifier-options/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Opsi dihapus', { id: t })
      await load()
    } catch {
      toast.error('Gagal menghapus opsi', { id: t })
    }
  }

  return (
    <div className="bg-stone-900 rounded-2xl mb-5 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-stone-800/40"
      >
        {open ? <ChevronDown className="w-5 h-5 text-stone-400" /> : <ChevronRight className="w-5 h-5 text-stone-400" />}
        <Layers className="w-4 h-4 text-amber-500" />
        <div className="flex-1">
          <p className="font-semibold">Grup Modifier</p>
          <p className="text-stone-500 text-xs">
            {groups.length} grup — atur ukuran, level gula, extra... lalu pasang ke menu lewat ikon layers di tabel bawah
          </p>
        </div>
      </button>

      {open && (
        <div className="border-t border-stone-800 p-4">
          {loading ? (
            <div className="space-y-2 py-2" aria-busy="true">
              {[0, 1, 2].map(i => (
                <div key={i} className="bg-stone-800/40 rounded-xl p-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded bg-stone-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-stone-700 rounded w-1/3" />
                      <div className="h-3 bg-stone-700 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* #6 Form tambah grup: label eksplisit, bukan placeholder-only */}
              <div className="bg-stone-800/40 rounded-xl p-3 mb-5">
                <p className="text-xs font-semibold text-stone-400 mb-3 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Grup Baru
                </p>
                <div className="grid md:grid-cols-4 gap-3 items-end">
                  <label className="block md:col-span-2">
                    <span className="text-xs text-stone-400">Nama Grup</span>
                    <input
                      placeholder="Ukuran, Level Gula..."
                      value={form.name}
                      onChange={e => { setForm({ ...form, name: e.target.value }); setError('') }}
                      onKeyDown={e => e.key === 'Enter' && createGroup()}
                      className="mt-1 w-full h-11 px-3 rounded-xl bg-stone-800 border border-stone-700 focus:border-amber-500 outline-none text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-stone-400">Max Pilih</span>
                    <input
                      type="number"
                      min="-1"
                      title="-1 = bebas"
                      value={form.max_select}
                      onChange={e => setForm({ ...form, max_select: e.target.value })}
                      className="mt-1 w-full h-11 px-3 rounded-xl bg-stone-800 border border-stone-700 outline-none text-sm"
                    />
                    <span className="text-[10px] text-stone-500">1 = radio, -1 = bebas</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm whitespace-nowrap cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.is_required}
                        onChange={e => setForm({ ...form, is_required: e.target.checked })}
                        className="w-5 h-5 accent-amber-500 cursor-pointer"
                      />
                      Wajib
                    </label>
                    <button
                      onClick={createGroup}
                      disabled={saving || !form.name.trim()}
                      className="flex items-center gap-1.5 h-11 px-4 rounded-xl bg-amber-500 text-stone-950 text-sm font-semibold hover:bg-amber-400 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Buat
                    </button>
                  </div>
                </div>
                {/* error di bawah field, nggak cuma di atas (rule: error near field) */}
                {error && <p className="text-red-400 text-xs mt-2 flex items-center gap-1"><Info className="w-3 h-3" />{error}</p>}
              </div>

              {/* groups */}
              <div className="space-y-2">
                {groups.map(g => {
                  const ex = expanded[g.id] ?? false
                  return (
                    <div key={g.id} className="bg-stone-800/40 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 p-3">
                        <button
                          onClick={() => setExpanded(p => ({ ...p, [g.id]: !ex }))}
                          className="text-stone-400 hover:text-stone-200"
                        >
                          {ex ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{g.name}</p>
                          <p className="text-stone-500 text-xs">
                            {g.is_required ? 'Wajib' : 'Opsional'} • max {g.max_select} • {g.options?.length || 0} opsi
                          </p>
                        </div>
                        {confirming === g.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => deleteGroup(g)}
                              className="h-7 px-2 rounded-lg bg-red-500 text-white text-[10px] font-bold"
                              aria-label={`Konfirmasi hapus grup ${g.name}`}
                            >
                              Hapus?
                            </button>
                            <button
                              onClick={() => setConfirming(null)}
                              className="h-7 px-2 rounded-lg bg-stone-700 text-stone-300 text-[10px]"
                              aria-label="Batal hapus grup"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => deleteGroup(g)}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"
                            title="Hapus grup"
                            aria-label={`Hapus grup ${g.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {ex && (
                        <div className="px-3 pb-3">
                          {/* tabel opsi: input lebih tinggi, tombol hapus anti mis-tap */}
                          <table className="w-full text-sm">
                            <thead className="text-stone-500 text-xs text-left">
                              <tr>
                                <th className="py-1 font-medium">Opsi</th>
                                <th className="py-1 font-medium text-right">+Harga</th>
                                <th className="py-1 w-10" />
                              </tr>
                            </thead>
                            <tbody>
                              {(g.options || []).map(o => (
                                <tr key={o.id} className="group">
                                  <td className="py-1 pr-2">
                                    <input
                                      aria-label={`Nama opsi ${o.name}`}
                                      defaultValue={o.name}
                                      onBlur={e => { if (e.target.value !== o.name) patchOption(o.id, e.target.value, o.price_add) }}
                                      className="w-full h-9 px-2 rounded-lg hover:bg-stone-800 focus:bg-stone-800 outline-none text-sm"
                                    />
                                  </td>
                                  <td className="py-1 pr-2">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <input
                                        type="number"
                                        min="0"
                                        aria-label={`Harga tambahan ${o.name}`}
                                        defaultValue={o.price_add}
                                        onBlur={e => { const v = Number(e.target.value); if (v !== o.price_add) patchOption(o.id, o.name, v) }}
                                        className="w-20 h-9 text-right px-2 rounded-lg hover:bg-stone-800 focus:bg-stone-800 outline-none text-sm text-amber-500"
                                      />
                                      {o.price_add > 0 && (
                                        <span className="text-stone-500 text-[10px] w-16 text-right">{formatRupiah(o.price_add)}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-1">
                                    {confirming === o.id ? (
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => { setConfirming(null); deleteOption(o.id) }}
                                          className="h-8 px-2 rounded-lg bg-red-500 text-white text-[10px] font-bold"
                                          aria-label={`Konfirmasi hapus opsi ${o.name}`}
                                        >
                                          Hapus
                                        </button>
                                        <button
                                          onClick={() => setConfirming(null)}
                                          className="h-8 px-2 rounded-lg bg-stone-700 text-stone-300 text-[10px]"
                                          aria-label="Batal hapus opsi"
                                        >
                                          Batal
                                        </button>
                                      </div>
                                    ) : savingOpt === o.id ? (
                                      <div className="w-9 h-9 flex items-center justify-center">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setConfirming(o.id)}
                                        className="w-9 h-9 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-500/20"
                                        aria-label={`Hapus opsi ${o.name}`}
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {(g.options || []).length === 0 && (
                            <p className="text-stone-500 text-xs text-center py-3">Belum ada opsi</p>
                          )}

                          <div className="flex gap-2 mt-2">
                            <input
                              aria-label={`Nama opsi baru di grup ${g.name}`}
                              placeholder="Opsi baru"
                              value={draft[g.id]?.name || ''}
                              onChange={e => setDraft(p => ({ ...p, [g.id]: { name: e.target.value, price_add: p[g.id]?.price_add ?? '0' } }))}
                              onKeyDown={e => e.key === 'Enter' && addOption(g.id)}
                              className="flex-1 h-9 px-3 rounded-lg bg-stone-800 border border-stone-700 focus:border-amber-500 outline-none text-sm"
                            />
                            <input
                              type="number"
                              min="0"
                              aria-label={`Harga tambahan opsi baru di grup ${g.name}`}
                              placeholder="+Rp"
                              value={draft[g.id]?.price_add ?? '0'}
                              onChange={e => setDraft(p => ({ ...p, [g.id]: { name: p[g.id]?.name ?? '', price_add: e.target.value } }))}
                              onKeyDown={e => e.key === 'Enter' && addOption(g.id)}
                              className="w-24 h-9 px-3 rounded-lg bg-stone-800 border border-stone-700 outline-none text-sm"
                            />
                            <button
                              onClick={() => addOption(g.id)}
                              disabled={!draft[g.id]?.name?.trim()}
                              className="w-9 h-9 flex items-center justify-center rounded-lg bg-stone-700 hover:bg-stone-600 disabled:opacity-50"
                              aria-label={`Tambah opsi ke grup ${g.name}`}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {groups.length === 0 && (
                  <div className="text-center py-8">
                    <div className="w-14 h-14 rounded-xl bg-stone-800/60 flex items-center justify-center mx-auto mb-3">
                      <Layers className="w-6 h-6 text-stone-600" />
                    </div>
                    <p className="text-stone-400 text-sm font-medium">Belum ada grup modifier</p>
                    <p className="text-stone-600 text-xs mt-1">Buat grup di atas, misal "Ukuran" atau "Level Gula"</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
