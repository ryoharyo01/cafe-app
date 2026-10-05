'use client'

import { useState } from 'react'
import { MenuItem, Category, SelectedModifier } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import { useCartStore } from '@/store/cart'
import { Plus, Minus, X, Check, UtensilsCrossed } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  categories: Category[]
  items: MenuItem[]
  loading?: boolean
}

export default function MenuList({ categories, items, loading = false }: Props) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)

  const filtered = activeCategory === 'all'
    ? items
    : items.filter(i => i.category?.slug === activeCategory)

  // #5 Loading state: skeleton kartu, bukan layar blank
  if (loading) {
    return (
      <div className="animate-pulse" aria-busy="true" aria-live="polite">
        <div className="flex gap-2 overflow-hidden pb-3 mb-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-11 w-20 rounded-xl bg-stone-800 shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-stone-900 rounded-2xl p-4 flex justify-between items-center h-[104px]">
              <div className="flex-1 mr-3 space-y-2">
                <div className="h-4 bg-stone-800 rounded w-1/2" />
                <div className="h-3 bg-stone-800 rounded w-3/4" />
                <div className="h-4 bg-stone-800 rounded w-1/4" />
              </div>
              <div className="w-12 h-12 rounded-xl bg-stone-800 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // #4 Empty state halaman: bukan layar blank polos
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16">
        <div className="w-20 h-20 rounded-2xl bg-stone-900 flex items-center justify-center mb-4">
          <UtensilsCrossed className="w-9 h-9 text-stone-600" />
        </div>
        <p className="font-semibold text-stone-200">Menu belum tersedia</p>
        <p className="text-stone-500 text-sm mt-2 max-w-64">
          Menu sedang disiapkan. Silakan panggil pelayan untuk bantuan.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-sm font-medium"
        >
          Muat ulang
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        <button
          onClick={() => setActiveCategory('all')}
          aria-pressed={activeCategory === 'all'}
          className={`px-4 h-11 rounded-xl text-sm font-medium whitespace-nowrap flex items-center ${
            activeCategory === 'all' ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300'
          }`}
        >
          Semua
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.slug)}
            aria-pressed={activeCategory === cat.slug}
            className={`px-4 h-11 rounded-xl text-sm font-medium whitespace-nowrap flex items-center ${
              activeCategory === cat.slug ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300'
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 gap-3">
        {filtered.map(item => (
          <button
            key={item.id}
            onClick={() => setSelectedItem(item)}
            className="bg-stone-900 rounded-2xl p-4 text-left hover:bg-stone-800 flex justify-between items-start"
          >
            <div className="flex-1 mr-3">
              <p className="font-semibold text-stone-100">{item.name}</p>
              {item.description && (
                <p className="text-stone-400 text-sm mt-1 line-clamp-2">{item.description}</p>
              )}
              <p className="text-amber-500 font-bold mt-2">{formatRupiah(item.base_price)}</p>
            </div>
            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center shrink-0" aria-hidden="true">
              <Plus className="w-6 h-6 text-stone-950" />
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-stone-500 text-center py-8">Tidak ada menu di kategori ini</p>
        )}
      </div>

      {/* Modifier Modal */}
      {selectedItem && (
        <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  )
}

function ItemModal({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const addItem = useCartStore(s => s.addItem)
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [selected, setSelected] = useState<Record<string, SelectedModifier[]>>({})

  const groups = item.modifier_groups || []

  function toggleOption(groupName: string, option: { id: string; name: string; price_add: number }, maxSelect: number) {
    setSelected(prev => {
      const current = prev[groupName] || []
      const exists = current.find(c => c.name === option.name)
      if (exists) {
        return { ...prev, [groupName]: current.filter(c => c.name !== option.name) }
      }
      if (maxSelect === 1) {
        return { ...prev, [groupName]: [{ id: option.id, name: option.name, group_name: groupName, price_add: option.price_add }] }
      }
      if (current.length >= maxSelect) return prev
      return { ...prev, [groupName]: [...current, { id: option.id, name: option.name, group_name: groupName, price_add: option.price_add }] }
    })
  }

  function isSelected(groupName: string, optionName: string) {
    return (selected[groupName] || []).some(s => s.name === optionName)
  }

  // Check required groups
  const missingRequired = groups.filter(g => g.is_required && (!selected[g.name] || selected[g.name].length === 0))

  const allModifiers = Object.values(selected).flat()
  const modPrice = allModifiers.reduce((s, m) => s + m.price_add, 0)
  const total = (item.base_price + modPrice) * quantity

  function handleAdd() {
    if (missingRequired.length > 0) {
      toast.error(`Pilih ${missingRequired.map(g => g.name).join(', ')} dulu`)
      return
    }
    addItem({
      menu_item_id: item.id,
      menu_item_name: item.name,
      quantity,
      unit_price: item.base_price,
      modifiers: allModifiers,
      notes,
    })
    toast.success(`${item.name} ditambahkan`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-stone-900 w-full max-w-md rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold">{item.name}</h3>
            <p className="text-stone-400 text-sm">{item.description}</p>
          </div>
          <button onClick={onClose} className="p-3 rounded-xl bg-stone-800" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modifier Groups */}
        {groups.map(group => (
          <div key={group.id} className="mb-5">
            <p className="font-semibold mb-2">
              {group.name} {group.is_required && <span className="text-red-400 text-xs">*wajib</span>}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {group.options.map(opt => {
                const on = isSelected(group.name, opt.name)
                const atMax = !on && group.max_select > 1 &&
                  (selected[group.name]?.length ?? 0) >= group.max_select
                return (
                  <button
                    key={opt.id}
                    disabled={atMax}
                    onClick={() => toggleOption(group.name, opt, group.max_select)}
                    className={`rounded-2xl p-3 text-left transition-colors disabled:opacity-40 ${
                      on
                        ? 'bg-amber-500 text-stone-950 ring-2 ring-amber-400'
                        : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`font-semibold text-sm ${on ? 'text-stone-950' : 'text-stone-100'}`}>
                          {opt.name}
                        </p>
                        <p className={`text-xs mt-1 ${on ? 'text-stone-800' : 'text-stone-400'}`}>
                          {opt.price_add > 0 ? `+${formatRupiah(opt.price_add)}` : 'Gratis'}
                        </p>
                      </div>
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        on ? 'bg-stone-950' : 'bg-stone-700'
                      }`}>
                        {on ? <Check className="w-3.5 h-3.5 text-amber-500" /> : <Plus className="w-3.5 h-3.5 text-stone-400" />}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            {group.max_select > 1 && (
              <p className="text-stone-500 text-xs mt-2">
                Pilih maks. {group.max_select} • terpilih {selected[group.name]?.length ?? 0}
              </p>
            )}
          </div>
        ))}

        {/* Notes */}
        <div className="mb-4">
          <p className="font-semibold mb-2">Catatan</p>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Contoh: extra hot, no foam..."
            className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-stone-100 placeholder:text-stone-500"
          />
        </div>

        {/* Quantity + Add */}
        <div className="flex items-center gap-4 mt-6">
          <div className="flex items-center gap-3 bg-stone-800 rounded-xl px-2">
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="p-2">
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-bold text-lg w-6 text-center">{quantity}</span>
            <button onClick={() => setQuantity(q => q + 1)} className="p-2">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleAdd}
            className="flex-1 py-4 bg-amber-500 text-stone-950 font-bold rounded-xl text-lg hover:bg-amber-400"
          >
            Tambah {formatRupiah(total)}
          </button>
        </div>
      </div>
    </div>
  )
}