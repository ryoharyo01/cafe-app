'use client'

import { useEffect, useState } from 'react'
import { Category, MenuItem } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import { Plus, Pencil, Trash2, X, Save, Loader2, Layers } from 'lucide-react'
import MenuFormModifiers from '@/components/MenuFormModifiers'
import toast from 'react-hot-toast'

const emptyForm = {
  name: '',
  category_id: '',
  base_price: '',
  description: '',
  image_url: '',
  stock: '-1',
  is_available: true,
}

export default function MasterMenu() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [msg, setMsg] = useState('')
  const [formGroups, setFormGroups] = useState<string[]>([])

  async function load() {
    setLoading(true)
    try {
      const [menuRes, menuData] = await Promise.all([
        fetch('/api/admin/menu'),
        fetch('/api/menu').then(r => r.json()),
      ])
      const adminData = await menuRes.json()
      setItems(adminData.items || [])
      setCategories(menuData.categories || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm, category_id: categories[0]?.id || '' })
    setFormGroups([])
    setShowForm(true)
    setMsg('')
  }

  function openEdit(item: MenuItem) {
    setEditing(item)
    setForm({
      name: item.name,
      category_id: item.category_id,
      base_price: String(item.base_price),
      description: item.description || '',
      image_url: item.image_url || '',
      stock: String(item.stock),
      is_available: item.is_available,
    })
    // kelompok modifiers diambil ulang oleh MenuFormModifiers lewat props itemId
    setFormGroups((item.modifier_groups || []).map(g => g.id))
    setShowForm(true)
    setMsg('')
  }

  async function save() {
    if (!form.name.trim() || !form.category_id || form.base_price === '') {
      setMsg('Nama, kategori, dan harga wajib diisi')
      return
    }
    setSaving(true)
    setMsg('')
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        category_id: form.category_id,
        base_price: Number(form.base_price),
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        stock: Number(form.stock),
        is_available: form.is_available,
      }
      const res = editing
        ? await fetch('/api/admin/menu', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editing.id, ...payload }),
          })
        : await fetch('/api/admin/menu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data.error || 'Gagal menyimpan')
        return
      }
      // pasang grup modifier yang dipilih (bikin baru + edit, satu alur simpan)
      const itemId = editing ? editing.id : data?.item?.id
      if (itemId) {
        await fetch(`/api/admin/menu/${itemId}/modifiers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_ids: formGroups }),
        })
      }
      toast.success(editing ? 'Menu diperbarui' : 'Menu ditambahkan')
      setShowForm(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: MenuItem) {
    if (!confirm(`Hapus "${item.name}"? Tindakan ini tidak bisa dibatalkan.`)) return
    await fetch('/api/admin/menu', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    })
    await load()
  }

  async function toggle(item: MenuItem) {
    await fetch('/api/admin/menu', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, is_available: !item.is_available }),
    })
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Daftar Menu ({items.length})</h2>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-stone-950 font-semibold hover:bg-amber-400"
        >
          <Plus className="w-4 h-4" /> Tambah Menu
        </button>
      </div>

      {showForm && (
        <div className="bg-stone-900 rounded-2xl p-5 mb-5 border border-stone-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">{editing ? `Edit: ${editing.name}` : 'Menu Baru'}</h3>
            <button onClick={() => setShowForm(false)} className="text-stone-400 hover:text-stone-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm text-stone-400">Nama</span>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 focus:border-amber-500 outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm text-stone-400">Kategori</span>
              <select
                value={form.category_id}
                onChange={e => setForm({ ...form, category_id: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 focus:border-amber-500 outline-none"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-stone-400">Harga Dasar (Rp)</span>
              <input
                type="number"
                min="0"
                value={form.base_price}
                onChange={e => setForm({ ...form, base_price: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 focus:border-amber-500 outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm text-stone-400">Stok (-1 = tak terbatas)</span>
              <input
                type="number"
                min="-1"
                value={form.stock}
                onChange={e => setForm({ ...form, stock: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 focus:border-amber-500 outline-none"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm text-stone-400">Deskripsi</span>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 focus:border-amber-500 outline-none"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm text-stone-400">URL Gambar (opsional)</span>
              <input
                value={form.image_url}
                onChange={e => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://..."
                className="w-full mt-1 px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 focus:border-amber-500 outline-none"
              />
            </label>

            <label className="flex items-center gap-3 md:col-span-2">
              <input
                type="checkbox"
                checked={form.is_available}
                onChange={e => setForm({ ...form, is_available: e.target.checked })}
                className="w-5 h-5 accent-amber-500"
              />
              <span className="text-sm">Tersedia untuk dipesan</span>
            </label>

            <MenuFormModifiers
              itemId={editing ? editing.id : null}
              selected={formGroups}
              onChange={setFormGroups}
            />
          </div>

          {msg && <p className="text-red-400 text-sm mt-3">{msg}</p>}

          <div className="flex gap-3 mt-5">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 text-stone-950 font-semibold hover:bg-amber-400 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="bg-stone-900 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-800 text-stone-400 text-left">
            <tr>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3 text-right">Harga</th>
              <th className="px-4 py-3 text-center">Stok</th>
              <th className="px-4 py-3 text-center">Modifier</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-t border-stone-800 hover:bg-stone-800/40">
                <td className="px-4 py-3">
                  <p className={`font-medium ${!item.is_available ? 'line-through text-stone-500' : ''}`}>{item.name}</p>
                  {item.description && <p className="text-stone-500 text-xs line-clamp-1">{item.description}</p>}
                </td>
                <td className="px-4 py-3 text-stone-400">{item.category?.icon} {item.category?.name || '-'}</td>
                <td className="px-4 py-3 text-right font-semibold text-amber-500">{formatRupiah(item.base_price)}</td>
                <td className="px-4 py-3 text-center text-stone-400">{item.stock === -1 ? '∞' : item.stock}</td>
                <td className="px-4 py-3 text-center">
                  {item.modifier_groups && item.modifier_groups.length > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-amber-500/15 text-amber-500"
                      title={item.modifier_groups.map(g => g.name).join(', ')}
                    >
                      <Layers className="w-3 h-3" /> {item.modifier_groups.length}
                    </span>
                  ) : (
                    <span className="text-stone-600 text-xs">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggle(item)}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      item.is_available ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {item.is_available ? 'Available' : 'Sold Out'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openEdit(item)}
                      className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300"
                      title="Edit"
                      aria-label={`Edit ${item.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(item)}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"
                      title="Hapus"
                      aria-label={`Hapus ${item.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <p className="text-stone-500 text-center py-10">Belum ada menu</p>
        )}
      </div>
    </div>
  )
}
