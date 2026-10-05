'use client'

import { useEffect, useState } from 'react'
import { formatRupiah } from '@/lib/utils'
import { Plus, Trash2, X, Loader2, Check, Layers } from 'lucide-react'
import toast from 'react-hot-toast'

interface Opt { id: string; group_id: string; name: string; price_add: number; sort_order: number }
interface Grp { id: string; name: string; is_required: boolean; max_select: number; options?: Opt[] }

interface Props {
  /** id menu item saat EDIT (null pas bikin menu baru) */
  itemId: string | null
  /** grup yang kepilih; dikontrol dari form induk */
  selected: string[]
  onChange: (ids: string[]) => void
}

/**
 * Bagian modifier yang di-embed ke dalam form Tambah/Edit Menu.
 * Satu tempat: pilih grup mana yang nempel ke menu ini + kelola grup/opsinya.
 */
export default function MenuFormModifiers({ itemId, selected, onChange }: Props) {
  const [groups, setGroups] = useState<Grp[]>([])
  const [loading, setLoading] = useState(true)
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  // form bikin grup baru (inline, jangan pindah tempat)
  const [newGroup, setNewGroup] = useState({ name: '', max_select: '1', is_required: false })
  const [creating, setCreating] = useState(false)

  // draft opsi baru per grup
  const [draft, setDraft] = useState<Record<string, { name: string; price_add: string }>>({})
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/modifier-groups')
        const d = await res.json()
        setGroups(d.groups || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // kalau lagi edit, ambil grup yang sudah kepasang
  useEffect(() => {
    if (!itemId) return
    fetch(`/api/admin/menu/${itemId}/modifiers`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.group_ids)) onChange(d.group_ids) })
      .catch(() => {})
  }, [itemId]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  async function createGroup() {
    if (!newGroup.name.trim()) {
      toast.error('Nama grup wajib diisi')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/modifier-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroup.name.trim(),
          is_required: newGroup.is_required,
          max_select: Number(newGroup.max_select) || 1,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'gagal')
      setGroups(p => [...p, { ...d.group, options: [] }])
      setNewGroup({ name: '', max_select: '1', is_required: false })
      setOpenGroup(d.group.id)
      onChange([...selected, d.group.id])
      toast.success(`Grup "${d.group.name}" dibuat & dipasang`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membuat grup')
    } finally {
      setCreating(false)
    }
  }

  async function addOption(gid: string) {
    const row = draft[gid]
    if (!row?.name?.trim()) {
      toast.error('Nama opsi wajib diisi')
      return
    }
    try {
      const res = await fetch(`/api/admin/modifier-groups/${gid}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: row.name.trim(), price_add: Number(row.price_add) || 0 }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'gagal')
      setGroups(p => p.map(g => g.id === gid
        ? { ...g, options: [...(g.options || []), d.option] }
        : g))
      setDraft(p => ({ ...p, [gid]: { name: '', price_add: '0' } }))
      toast.success('Opsi ditambahkan')
    } catch {
      toast.error('Gagal menambah opsi')
    }
  }

  async function patchOption(gid: string, id: string, name: string, price: number) {
    try {
      const res = await fetch(`/api/admin/modifier-options/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price_add: price }),
      })
      if (!res.ok) throw new Error()
      setGroups(p => p.map(g => g.id === gid
        ? { ...g, options: (g.options || []).map(o => o.id === id ? { ...o, name, price_add: price } : o) }
        : g))
      toast.success('Opsi diperbarui')
    } catch {
      toast.error('Gagal memperbarui opsi')
    }
  }

  async function deleteOption(gid: string, id: string) {
    const t = toast.loading('Menghapus opsi...')
    try {
      const res = await fetch(`/api/admin/modifier-options/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setGroups(p => p.map(g => g.id === gid
        ? { ...g, options: (g.options || []).filter(o => o.id !== id) }
        : g))
      toast.success('Opsi dihapus', { id: t })
    } catch {
      toast.error('Gagal menghapus opsi', { id: t })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-stone-500 text-sm" aria-busy="true">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat grup modifier...
      </div>
    )
  }

  return (
    <div className="md:col-span-2 border-t border-stone-800 pt-5 mt-1">
      <div className="flex items-center gap-2 mb-1">
        <Layers className="w-4 h-4 text-amber-500" />
        <span className="font-semibold text-sm">Modifier Menu Ini</span>
      </div>
      <p className="text-stone-500 text-xs mb-4">
        Pilih grup yang nempel ke menu ini. Grup bisa dibuat & diisi opsinya langsung di bawah — nggak perlu pindah tempat.
      </p>

      {/* daftar grup: pilih/pasang */}
      {groups.length === 0 ? (
        <p className="text-stone-500 text-sm text-center py-4 bg-stone-800/40 rounded-xl">
          Belum ada grup. Buat di bawah.
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map(g => {
            const on = selected.includes(g.id)
            const expanded = openGroup === g.id
            const opts = g.options || []
            return (
              <div
                key={g.id}
                className={`rounded-xl border transition-colors ${
                  on ? 'bg-amber-500/10 border-amber-500/40' : 'bg-stone-800/40 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    id={`grp-${g.id}`}
                    checked={on}
                    onChange={() => toggle(g.id)}
                    className="w-5 h-5 accent-amber-500 cursor-pointer shrink-0"
                  />
                  <label htmlFor={`grp-${g.id}`} className="flex-1 min-w-0 cursor-pointer">
                    <p className="font-medium text-sm">{g.name}</p>
                    <p className="text-stone-500 text-xs">
                      {g.is_required ? 'Wajib' : 'Opsional'} • max {g.max_select} • {opts.length} opsi
                    </p>
                  </label>
                  <button
                    onClick={() => setOpenGroup(expanded ? null : g.id)}
                    className="h-8 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-stone-300 shrink-0"
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Tutup' : 'Kelola'} opsi grup ${g.name}`}
                  >
                    {expanded ? 'Tutup' : 'Opsi'}
                  </button>
                </div>

                {expanded && (
                  <div className="px-3 pb-3">
                    <table className="w-full text-sm">
                      <thead className="text-stone-500 text-[11px] text-left">
                        <tr>
                          <th className="py-1 font-normal">Opsi</th>
                          <th className="py-1 font-normal text-right">+Harga</th>
                          <th className="py-1 w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {opts.map(o => (
                          <tr key={o.id}>
                            <td className="py-0.5 pr-2">
                              <input
                                aria-label={`Nama opsi ${o.name}`}
                                defaultValue={o.name}
                                onBlur={e => { if (e.target.value !== o.name) patchOption(g.id, o.id, e.target.value, o.price_add) }}
                                className="w-full h-8 px-2 rounded-lg hover:bg-stone-800 focus:bg-stone-800 outline-none text-sm"
                              />
                            </td>
                            <td className="py-0.5 pr-2">
                              <div className="flex items-center justify-end gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  aria-label={`Harga tambahan ${o.name}`}
                                  defaultValue={o.price_add}
                                  onBlur={e => { const v = Number(e.target.value); if (v !== o.price_add) patchOption(g.id, o.id, o.name, v) }}
                                  className="w-16 h-8 text-right px-2 rounded-lg hover:bg-stone-800 focus:bg-stone-800 outline-none text-sm text-amber-500"
                                />
                                {o.price_add > 0 && (
                                  <span className="text-stone-500 text-[10px] w-14 text-right">{formatRupiah(o.price_add)}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-0.5">
                              {confirming === o.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => { setConfirming(null); deleteOption(g.id, o.id) }}
                                    className="h-7 px-2 rounded-lg bg-red-500 text-white text-[10px] font-bold"
                                    aria-label={`Konfirmasi hapus opsi ${o.name}`}
                                  >
                                    Hapus
                                  </button>
                                  <button
                                    onClick={() => setConfirming(null)}
                                    className="h-7 px-2 rounded-lg bg-stone-700 text-stone-300 text-[10px]"
                                    aria-label="Batal hapus opsi"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirming(o.id)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-500/20"
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
                    {opts.length === 0 && (
                      <p className="text-stone-500 text-xs text-center py-2">Belum ada opsi</p>
                    )}

                    <div className="flex gap-2 mt-2">
                      <input
                        aria-label={`Opsi baru untuk grup ${g.name}`}
                        placeholder="Opsi baru"
                        value={draft[g.id]?.name || ''}
                        onChange={e => setDraft(p => ({ ...p, [g.id]: { name: e.target.value, price_add: p[g.id]?.price_add ?? '0' } }))}
                        onKeyDown={e => e.key === 'Enter' && addOption(g.id)}
                        className="flex-1 h-8 px-3 rounded-lg bg-stone-800 border border-stone-700 focus:border-amber-500 outline-none text-sm"
                      />
                      <input
                        type="number"
                        min="0"
                        aria-label={`Harga tambahan opsi baru grup ${g.name}`}
                        placeholder="+Rp"
                        value={draft[g.id]?.price_add ?? '0'}
                        onChange={e => setDraft(p => ({ ...p, [g.id]: { name: p[g.id]?.name ?? '', price_add: e.target.value } }))}
                        onKeyDown={e => e.key === 'Enter' && addOption(g.id)}
                        className="w-20 h-8 px-2 rounded-lg bg-stone-800 border border-stone-700 outline-none text-sm"
                      />
                      <button
                        onClick={() => addOption(g.id)}
                        disabled={!draft[g.id]?.name?.trim()}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-stone-700 hover:bg-stone-600 disabled:opacity-50"
                        aria-label={`Tambah opsi ke grup ${g.name}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* bikin grup baru — inline, autootomatis kepasang ke menu ini */}
      <div className="mt-4 p-3 rounded-xl bg-stone-800/40 border border-dashed border-stone-700">
        <p className="text-xs font-semibold text-stone-400 mb-2">Grup Baru</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Nama grup modifier baru"
            placeholder="Nama grup (Ukuran, Level Gula...)"
            value={newGroup.name}
            onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && createGroup()}
            className="flex-1 min-w-40 h-9 px-3 rounded-lg bg-stone-800 border border-stone-700 focus:border-amber-500 outline-none text-sm"
          />
          <input
            type="number"
            min="-1"
            aria-label="Maksimal pilih untuk grup baru"
            title="1 = pilih satu, -1 = bebas"
            value={newGroup.max_select}
            onChange={e => setNewGroup({ ...newGroup, max_select: e.target.value })}
            className="w-16 h-9 px-2 rounded-lg bg-stone-800 border border-stone-700 outline-none text-sm text-center"
          />
          <label className="flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer">
            <input
              type="checkbox"
              checked={newGroup.is_required}
              onChange={e => setNewGroup({ ...newGroup, is_required: e.target.checked })}
              className="w-4 h-4 accent-amber-500 cursor-pointer"
            />
            Wajib
          </label>
          <button
            onClick={createGroup}
            disabled={creating || !newGroup.name.trim()}
            className="flex items-center gap-1 h-9 px-3 rounded-lg bg-amber-500 text-stone-950 text-xs font-semibold hover:bg-amber-400 disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Buat
          </button>
        </div>
        <p className="text-stone-600 text-[10px] mt-1.5">
          Grup baru otomatis dipasang ke menu ini. Tambah opsi tombol "Opsi" setelah dibuat.
        </p>
      </div>

      {selected.length > 0 && (
        <p className="text-amber-500 text-xs mt-3 flex items-center gap-1">
          <Check className="w-3 h-3" /> {selected.length} grup terpasang — tersimpan bareng menu
        </p>
      )}
    </div>
  )
}
