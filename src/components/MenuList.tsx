'use client'

import { useState } from 'react'
import { MenuItem, Category, SelectedModifier } from '@/lib/types'
import { formatRupiah, isSoldOut, maxOrderQty } from '@/lib/utils'
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Ambil dari props terbaru supaya stok di modal ikut ter-update saat polling
  const selectedItem = items.find(i => i.id === selectedId) ?? null

  // Menu yang habis ditaruh paling bawah
  const filtered = (activeCategory === 'all'
    ? [...items]
    : items.filter(i => i.category?.slug === activeCategory)
  ).sort((a, b) => Number(isSoldOut(a)) - Number(isSoldOut(b)))

  function handleSelect(item: MenuItem) {
    if (isSoldOut(item)) {
      toast.error(`${item.name} lagi habis 🙏`)
      return
    }
    setSelectedId(item.id)
  }

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
            <div key={i} className="bg-stone-900 rounded-2xl p-3 flex justify-between items-center h-[120px]">
              <div className="w-24 h-24 rounded-xl bg-stone-800 shrink-0 mr-3" />
              <div className="flex-1 mr-3 space-y-2">
                <div className="h-4 bg-stone-800 rounded w-1/2" />
                <div className="h-3 bg-stone-800 rounded w-3/4" />
                <div className="h-4 bg-stone-800 rounded w-1/4" />
              </div>
              <div className="w-10 h-10 rounded-xl bg-stone-800 shrink-0" />
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
        {filtered.map(item => {
          const soldOut = isSoldOut(item)
          const lowStock = !soldOut && item.stock !== -1 && item.stock <= 5
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              aria-disabled={soldOut}
              className={`bg-stone-900 rounded-2xl p-3 text-left flex items-center ${
                soldOut ? 'cursor-not-allowed' : 'hover:bg-stone-800'
              }`}
            >
              <div className="relative shrink-0 mr-3">
                <MenuPhoto item={item} className={`w-24 h-24 rounded-xl ${soldOut ? 'grayscale opacity-40' : ''}`} />
                {soldOut && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg -rotate-6">HABIS</span>
                  </span>
                )}
              </div>
              <div className={`flex-1 min-w-0 mr-3 ${soldOut ? 'opacity-50' : ''}`}>
                <p className="font-semibold text-stone-100">{item.name}</p>
                {item.description && (
                  <p className="text-stone-400 text-sm mt-1 line-clamp-2">{item.description}</p>
                )}
                <p className="text-amber-500 font-bold mt-2">{formatRupiah(item.base_price)}</p>
                {soldOut && <p className="text-red-400 text-xs font-semibold mt-1">Sold out</p>}
                {lowStock && <p className="text-amber-300 text-xs mt-1">Sisa {item.stock}</p>}
              </div>
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  soldOut ? 'bg-stone-800' : 'bg-amber-500'
                }`}
                aria-hidden="true"
              >
                {soldOut
                  ? <X className="w-5 h-5 text-stone-500" />
                  : <Plus className="w-5 h-5 text-stone-950" />}
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-stone-500 text-center py-8">Tidak ada menu di kategori ini</p>
        )}
      </div>

      {/* Modifier Modal */}
      {selectedItem && (
        <ItemModal item={selectedItem} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}

// Menu photo with a neutral placeholder when there's no image or it fails to load
export function MenuPhoto({ item, className, eager = false }: {
  item: { name: string; image_url?: string | null }
  className: string
  eager?: boolean
}) {
  const [failed, setFailed] = useState(false)
  if (!item.image_url || failed) {
    return (
      <div className={`${className} bg-stone-800 flex items-center justify-center shrink-0`} aria-hidden="true">
        <UtensilsCrossed className="w-7 h-7 text-stone-600" />
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- image_url may be any external URL set in admin
    <img
      src={item.image_url}
      alt={item.name}
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
      className={`${className} object-cover shrink-0 bg-stone-800`}
    />
  )
}

// Dipakai juga dari keranjang untuk ubah item (editIndex = baris keranjang yang diubah)
export function ItemModal({ item, onClose, editIndex }: { item: MenuItem; onClose: () => void; editIndex?: number }) {
  const addItem = useCartStore(s => s.addItem)
  const updateItem = useCartStore(s => s.updateItem)
  const editing = useCartStore(s => (editIndex != null ? s.items[editIndex] : undefined))
  const inCart = useCartStore(s => s.getQuantityFor(item.id))
  const [quantity, setQuantity] = useState(editing?.quantity ?? 1)

  // Sisa yang masih bisa ditambah = stok dikurangi yang sudah ada di keranjang
  // (baris yang sedang diubah tidak ikut dihitung)
  const remaining = Math.max(0, maxOrderQty(item) - inCart + (editing?.quantity ?? 0))
  const canAdd = remaining > 0 && quantity <= remaining
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [selected, setSelected] = useState<Record<string, SelectedModifier[]>>(() => {
    const init: Record<string, SelectedModifier[]> = {}
    for (const m of editing?.modifiers ?? []) (init[m.group_name] ??= []).push(m)
    return init
  })
  const [highlightMissing, setHighlightMissing] = useState(false)

  const groups = item.modifier_groups || []

  function toModifier(groupName: string, option: { id: string; name: string; price_add: number }): SelectedModifier {
    return { id: option.id, name: option.name, group_name: groupName, price_add: option.price_add }
  }

  // Grup pilih-satu: tap untuk pilih/batal
  function toggleOption(groupName: string, option: { id: string; name: string; price_add: number }) {
    setSelected(prev => {
      const on = (prev[groupName] || []).some(c => c.id === option.id)
      return { ...prev, [groupName]: on ? [] : [toModifier(groupName, option)] }
    })
  }

  // Grup multi-pilih: opsi bisa diambil berkali-kali (Extra Shot ×2), total per grup maks max_select
  function changeCount(groupName: string, option: { id: string; name: string; price_add: number }, delta: 1 | -1, maxSelect: number) {
    setSelected(prev => {
      const current = prev[groupName] || []
      if (delta === 1) {
        if (current.length >= maxSelect) return prev
        return { ...prev, [groupName]: [...current, toModifier(groupName, option)] }
      }
      const idx = current.findLastIndex(c => c.id === option.id)
      if (idx === -1) return prev
      return { ...prev, [groupName]: current.filter((_, i) => i !== idx) }
    })
  }

  function countOf(groupName: string, optionId: string) {
    return (selected[groupName] || []).filter(s => s.id === optionId).length
  }

  // Check required groups
  const missingRequired = groups.filter(g => g.is_required && (!selected[g.name] || selected[g.name].length === 0))

  // Urutkan sesuai urutan grup di menu, bukan urutan tap
  const allModifiers = groups.flatMap(g => selected[g.name] || [])
  const modPrice = allModifiers.reduce((s, m) => s + m.price_add, 0)
  const total = (item.base_price + modPrice) * quantity

  function handleAdd() {
    if (isSoldOut(item)) {
      toast.error(`${item.name} lagi habis 🙏`)
      onClose()
      return
    }
    if (quantity > remaining) {
      toast.error(remaining > 0
        ? `Stok ${item.name} tinggal ${remaining} lagi`
        : `Stok ${item.name} sudah habis di keranjangmu`)
      return
    }
    if (missingRequired.length > 0) {
      // id tetap supaya tap berulang tidak menumpuk toast
      toast.error(`Pilih ${missingRequired.map(g => g.name).join(', ')} dulu`, { id: 'modifier-required' })
      // Grup yang kelewat sering ada di atas layar, scroll ke sana + sorot
      setHighlightMissing(true)
      document.getElementById(`modgroup-${missingRequired[0].id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    const cartItem = {
      menu_item_id: item.id,
      menu_item_name: item.name,
      quantity,
      unit_price: item.base_price,
      modifiers: allModifiers,
      notes,
      image_url: item.image_url,
    }
    if (editIndex != null && editing) {
      updateItem(editIndex, cartItem)
      toast.success(`${item.name} diperbarui`)
    } else {
      addItem(cartItem)
      toast.success(`${item.name} ditambahkan`)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-stone-900 w-full max-w-md rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {item.image_url && (
          <MenuPhoto item={item} className="w-full aspect-[4/3] rounded-2xl mb-4" eager />
        )}
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
        {groups.map(group => {
          const missing = highlightMissing && missingRequired.some(g => g.id === group.id)
          const multi = group.max_select > 1
          const groupCount = selected[group.name]?.length ?? 0
          return (
          <div
            key={group.id}
            id={`modgroup-${group.id}`}
            className={`mb-5 rounded-2xl transition-colors ${missing ? 'ring-2 ring-red-500 p-3 -m-3 mb-2' : ''}`}
          >
            <p className="font-semibold mb-2">
              {group.name} {group.is_required && <span className="text-red-400 text-xs">*wajib</span>}
              {missing && <span className="text-red-400 text-xs ml-2">← belum dipilih</span>}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {group.options.map(opt => {
                const count = countOf(group.name, opt.id)
                const on = count > 0
                const price = (
                  <p className={`text-xs mt-1 ${on ? 'text-stone-800' : 'text-stone-400'}`}>
                    {opt.price_add > 0 ? `+${formatRupiah(opt.price_add)}` : 'Gratis'}
                  </p>
                )
                if (multi) {
                  const full = groupCount >= group.max_select
                  return (
                    <div
                      key={opt.id}
                      className={`rounded-2xl p-3 transition-colors ${
                        on ? 'bg-amber-500 text-stone-950 ring-2 ring-amber-400' : 'bg-stone-800 text-stone-300'
                      }`}
                    >
                      <p className={`font-semibold text-sm ${on ? 'text-stone-950' : 'text-stone-100'}`}>{opt.name}</p>
                      {price}
                      <div className="flex items-center justify-between mt-2">
                        <button
                          onClick={() => changeCount(group.name, opt, -1, group.max_select)}
                          disabled={!on}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 ${on ? 'bg-stone-950' : 'bg-stone-700'}`}
                          aria-label={`Kurangi ${opt.name}`}
                        >
                          <Minus className={`w-4 h-4 ${on ? 'text-amber-500' : 'text-stone-400'}`} />
                        </button>
                        <span className="font-bold w-6 text-center" aria-label={`Jumlah ${opt.name}`}>{count}</span>
                        <button
                          onClick={() => changeCount(group.name, opt, 1, group.max_select)}
                          disabled={full}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 ${on ? 'bg-stone-950' : 'bg-stone-700'}`}
                          aria-label={`Tambah ${opt.name}`}
                        >
                          <Plus className={`w-4 h-4 ${on ? 'text-amber-500' : 'text-stone-400'}`} />
                        </button>
                      </div>
                    </div>
                  )
                }
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleOption(group.name, opt)}
                    aria-pressed={on}
                    className={`rounded-2xl p-3 text-left transition-colors ${
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
                        {price}
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
            {multi && (
              <p className="text-stone-500 text-xs mt-2">
                Pilih maks. {group.max_select} • terpilih {groupCount}
              </p>
            )}
          </div>
          )
        })}

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

        {/* Info stok terbatas */}
        {item.stock !== -1 && (
          <p className={`text-sm mt-4 ${remaining > 0 ? 'text-amber-300' : 'text-red-400'}`}>
            {remaining > 0
              ? `Sisa stok ${item.stock}${inCart > 0 ? ` • ${inCart} sudah di keranjang` : ''}`
              : `Stok habis${inCart > 0 ? ` • ${inCart} sudah di keranjang` : ''}`}
          </p>
        )}

        {/* Quantity + Add */}
        <div className="flex items-center gap-4 mt-6">
          <div className="flex items-center gap-3 bg-stone-800 rounded-xl px-2">
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="p-2" aria-label="Kurangi">
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-bold text-lg w-6 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(q => Math.min(Math.max(1, remaining), q + 1))}
              disabled={quantity >= remaining}
              className="p-2 disabled:opacity-30"
              aria-label="Tambah"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="flex-1 py-4 bg-amber-500 text-stone-950 font-bold rounded-xl text-lg hover:bg-amber-400 disabled:bg-stone-700 disabled:text-stone-400"
          >
            {!canAdd ? 'Stok habis' : editing ? `Simpan ${formatRupiah(total)}` : `Tambah ${formatRupiah(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
