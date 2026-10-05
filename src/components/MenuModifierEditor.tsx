'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Check } from 'lucide-react'

interface ModifierOption {
  id: string
  group_id: string
  name: string
  price_add: number
}

interface ModifierGroup {
  id: string
  name: string
  is_required: boolean
  max_select: number
  options?: ModifierOption[]
}

interface Props {
  itemId: string
  itemName: string
  onClose: () => void
}

export default function MenuModifierEditor({ itemId, itemName, onClose }: Props) {
  const [groups, setGroups] = useState<ModifierGroup[]>([])
  const [attached, setAttached] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [gRes, mRes] = await Promise.all([
        fetch('/api/admin/modifier-groups'),
        fetch(`/api/admin/menu/${itemId}/modifiers`),
      ])
      const gData = await gRes.json()
      const mData = await mRes.json()
      setGroups(gData.groups || [])
      setAttached(mData.group_ids || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [itemId])

  function toggle(id: string) {
    setAttached(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  async function save() {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch(`/api/admin/menu/${itemId}/modifiers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_ids: attached }),
      })
      if (res.ok) {
        onClose()
      } else {
        const d = await res.json()
        setMsg(d.error || 'Gagal menyimpan')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-stone-900 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-stone-700">
        <div className="flex items-center justify-between p-5 border-b border-stone-800">
          <div>
            <h3 className="font-bold text-lg">Modifier Menu</h3>
            <p className="text-stone-500 text-sm">{itemName}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          ) : groups.length === 0 ? (
            <p className="text-stone-500 text-center py-8 text-sm">
              Belum ada grup modifier. Buat dulu di tab Master Modifier.
            </p>
          ) : (
            <div className="space-y-2">
              {groups.map(g => {
                const on = attached.includes(g.id)
                return (
                  <label
                    key={g.id}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border ${
                      on ? 'bg-amber-500/10 border-amber-500/40' : 'bg-stone-800/50 border-transparent hover:bg-stone-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(g.id)}
                      className="w-5 h-5 accent-amber-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{g.name}</p>
                      <p className="text-stone-500 text-xs">
                        {g.is_required ? 'Wajib' : 'Opsional'} • max {g.max_select} •{' '}
                        {(g.options || []).map(o =>
                          o.price_add > 0 ? `${o.name} +${o.price_add}` : o.name
                        ).join(', ')}
                      </p>
                    </div>
                    {on && <Check className="w-4 h-4 text-amber-500" />}
                  </label>
                )
              })}
            </div>
          )}
          {msg && <p className="text-red-400 text-sm mt-3">{msg}</p>}
        </div>

        <div className="p-5 border-t border-stone-800 flex gap-3">
          <button
            onClick={save}
            disabled={saving || loading}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-amber-500 text-stone-950 font-semibold hover:bg-amber-400 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Simpan ({attached.length} grup)
          </button>
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700">
            Batal
          </button>
        </div>
      </div>
    </div>
  )
}
