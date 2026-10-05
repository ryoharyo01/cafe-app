'use client'

import { useEffect, useMemo, useState } from 'react'
import { MenuItem, Order } from '@/lib/types'
import { formatRupiah, cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Loader2,
  Banknote,
  X,
  CheckCircle2,
  ReceiptText,
} from 'lucide-react'

type CartLine = {
  menu_item_id: string
  name: string
  unit_price: number
  quantity: number
  is_available: boolean
  stock: number
}

type CashResult = {
  order: Order
  cash_received: number
  change: number
}

/** Usulan pecahan uang tunai: dibulatkan ke atas lalu beberapa kelipatan bulat. */
function cashSuggestions(total: number): number[] {
  if (total <= 0) return []
  const roundTo = (step: number) => Math.ceil(total / step) * step
  const candidates = new Set<number>([
    roundTo(1000),
    roundTo(5000),
    roundTo(10000),
    roundTo(50000),
  ])
  for (const c of Array.from(candidates)) {
    candidates.add(c + 10000)
  }
  const clean = Array.from(candidates)
    .filter((c) => c >= total)
    .sort((a, b) => a - b)
  return Array.from(new Set(clean)).slice(0, 4)
}

export default function POS() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [cart, setCart] = useState<CartLine[]>([])
  const [notes, setNotes] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [cashInput, setCashInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<CashResult | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/pos/menu')
        const data = await res.json()
        if (alive) setItems(data.items || [])
      } catch {
        if (alive) toast.error('Gagal memuat menu')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  const categories = useMemo(() => {
    const map = new Map<string, string>()
    for (const it of items) {
      if (it.category?.id && it.category?.name) map.set(it.category.id, it.category.name)
    }
    return Array.from(map, ([id, name]) => ({ id, name }))
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      if (activeCategory !== 'all' && it.category_id !== activeCategory) return false
      if (!q) return true
      return it.name.toLowerCase().includes(q)
    })
  }, [items, query, activeCategory])

  const total = cart.reduce((s, l) => s + l.unit_price * l.quantity, 0)
  const itemCount = cart.reduce((s, l) => s + l.quantity, 0)
  const cashValue = Number(cashInput) || 0
  const change = cashValue - total
  const suggestions = useMemo(() => cashSuggestions(total), [total])

  function maxQtyFor(item: MenuItem) {
    if (item.stock !== -1 && item.stock < 99) return item.stock
    return 99
  }

  function addToCart(item: MenuItem) {
    if (!item.is_available) {
      toast.error(`${item.name} sedang tidak tersedia`)
      return
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.menu_item_id === item.id)
      const limit = maxQtyFor(item)
      if (existing) {
        if (existing.quantity >= limit) {
          toast.error(`Stok ${item.name} cuma ${limit}`)
          return prev
        }
        return prev.map((l) =>
          l.menu_item_id === item.id ? { ...l, quantity: l.quantity + 1 } : l
        )
      }
      if (limit < 1) {
        toast.error(`Stok ${item.name} habis`)
        return prev
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          name: item.name,
          unit_price: item.base_price,
          quantity: 1,
          is_available: item.is_available,
          stock: item.stock,
        },
      ]
    })
  }

  function changeQty(menuItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.menu_item_id !== menuItemId) return l
          const limit = l.stock !== -1 ? Math.min(l.stock, 99) : 99
          const next = Math.min(l.quantity + delta, limit)
          return { ...l, quantity: next }
        })
        .filter((l) => l.quantity > 0)
    )
  }

  function removeLine(menuItemId: string) {
    setCart((prev) => prev.filter((l) => l.menu_item_id !== menuItemId))
  }

  function resetAll() {
    setCart([])
    setNotes('')
    setCashInput('')
    setCheckoutOpen(false)
    setResult(null)
  }

  async function submitCash() {
    if (cashValue < total) {
      toast.error('Uang tunai kurang dari total')
      return
    }
    setSubmitting(true)
    let createdOrderId: string | null = null
    try {
      const createRes = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity })),
          notes: notes.trim() || null,
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData.error || 'Gagal membuat pesanan')
      createdOrderId = createData.order.id as string

      const payRes = await fetch(`/api/pos/orders/${createdOrderId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cash_received: cashValue }),
      })
      const payData = await payRes.json()
      if (!payRes.ok) throw new Error(payData.error || 'Gagal memproses pembayaran')

      setResult({
        order: payData.order,
        cash_received: payData.cash_received,
        change: payData.change,
      })
      setCart([])
      setNotes('')
      toast.success('Pembayaran tunai berhasil')
    } catch (err: any) {
      toast.error(err?.message || 'Terjadi kesalahan')
      // Order sudah terbuat tapi bayar gagal — coba batalkan biar tidak menggantung
      if (createdOrderId) {
        try {
          await fetch(`/api/pos/orders/${createdOrderId}/cancel`, { method: 'POST' })
        } catch {
          /* biarkan kasir menangani manual */
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
      {/* ===== Kiri: katalog menu ===== */}
      <div>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari menu..."
              className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/60"
            />
          </div>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveCategory('all')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium',
              activeCategory === 'all'
                ? 'bg-amber-500 text-stone-950'
                : 'bg-stone-900 text-stone-300 hover:bg-stone-800'
            )}
          >
            Semua
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm whitespace-nowrap font-medium',
                activeCategory === c.id
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-stone-900 text-stone-300 hover:bg-stone-800'
              )}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {filtered.map((item) => {
            const limited = item.stock !== -1
            const outOfStock = limited && item.stock < 1
            const disabled = !item.is_available || outOfStock
            return (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                disabled={disabled}
                className={cn(
                  'text-left bg-stone-900 border rounded-2xl p-4 transition-all',
                  disabled
                    ? 'border-stone-800 opacity-45 cursor-not-allowed'
                    : 'border-stone-800 hover:border-amber-500/60 hover:bg-stone-800/60 active:scale-[0.98]'
                )}
              >
                <p className="font-semibold text-sm leading-snug mb-1">{item.name}</p>
                <p className="text-amber-500 font-bold">{formatRupiah(item.base_price)}</p>
                <div className="mt-2 flex items-center gap-2 text-[11px]">
                  {!item.is_available ? (
                    <span className="text-red-400">Nonaktif</span>
                  ) : outOfStock ? (
                    <span className="text-red-400">Stok habis</span>
                  ) : limited ? (
                    <span className="text-stone-500">stok {item.stock}</span>
                  ) : (
                    <span className="text-stone-500">tersedia</span>
                  )}
                </div>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-stone-500 col-span-full text-center py-10">Menu tidak ditemukan</p>
          )}
        </div>
      </div>

      {/* ===== Kanan: keranjang ===== */}
      <div className="lg:sticky lg:top-20 h-fit bg-stone-900 border border-stone-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold">Keranjang</h3>
          <span className="ml-auto text-sm text-stone-400">{itemCount} item</span>
        </div>

        <div className="space-y-2 max-h-[45vh] overflow-y-auto mb-4">
          {cart.length === 0 && (
            <p className="text-stone-500 text-sm text-center py-8">
              Belum ada item. Klik menu di sebelah kiri.
            </p>
          )}
          {cart.map((l) => (
            <div key={l.menu_item_id} className="bg-stone-950 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{l.name}</p>
                  <p className="text-xs text-stone-400">{formatRupiah(l.unit_price)}</p>
                </div>
                <button
                  onClick={() => removeLine(l.menu_item_id)}
                  className="text-stone-500 hover:text-red-400 shrink-0"
                  title="Hapus"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => changeQty(l.menu_item_id, -1)}
                    className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 flex items-center justify-center"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{l.quantity}</span>
                  <button
                    onClick={() => changeQty(l.menu_item_id, 1)}
                    className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-stone-700 flex items-center justify-center"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="font-bold text-amber-500 text-sm">
                  {formatRupiah(l.unit_price * l.quantity)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan pesanan (opsional)"
          rows={2}
          className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-amber-500/60 resize-none"
        />

        <div className="flex items-center justify-between py-3 border-t border-stone-800">
          <span className="text-stone-400 text-sm">Total</span>
          <span className="text-2xl font-black text-amber-500">{formatRupiah(total)}</span>
        </div>

        <button
          onClick={() => {
            setCashInput('')
            setResult(null)
            setCheckoutOpen(true)
          }}
          disabled={cart.length === 0}
          className="w-full mt-2 bg-amber-500 text-stone-950 py-3 rounded-xl font-bold hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Banknote className="w-5 h-5" />
          Bayar Tunai
        </button>
      </div>

      {/* ===== Modal bayar tunai ===== */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md p-6">
            {!result ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-amber-500" /> Pembayaran Tunai
                  </h3>
                  <button
                    onClick={() => setCheckoutOpen(false)}
                    className="text-stone-500 hover:text-stone-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-stone-950 rounded-xl p-4 mb-4 space-y-2">
                  {cart.map((l) => (
                    <div key={l.menu_item_id} className="flex justify-between text-sm">
                      <span className="text-stone-300">
                        {l.quantity}× {l.name}
                      </span>
                      <span className="text-stone-400">
                        {formatRupiah(l.unit_price * l.quantity)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-stone-800 font-bold">
                    <span>Total</span>
                    <span className="text-amber-500">{formatRupiah(total)}</span>
                  </div>
                </div>

                <label className="text-sm text-stone-400">Uang diterima</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  placeholder="0"
                  autoFocus
                  className="w-full mt-1 bg-stone-950 border border-stone-800 rounded-xl p-3 text-2xl font-bold text-right focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                />

                <div className="flex flex-wrap gap-2 mt-3">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setCashInput(String(s))}
                      className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-sm"
                    >
                      {formatRupiah(s)}
                    </button>
                  ))}
                  <button
                    onClick={() => setCashInput(String(total))}
                    className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-sm"
                  >
                    Uang pas
                  </button>
                </div>

                <div className="flex items-center justify-between mt-4 py-3 border-t border-stone-800">
                  <span className="text-stone-400">Kembalian</span>
                  <span
                    className={cn(
                      'text-xl font-bold',
                      cashValue >= total && total > 0 ? 'text-green-500' : 'text-stone-600'
                    )}
                  >
                    {formatRupiah(Math.max(change, 0))}
                  </span>
                </div>

                <button
                  onClick={submitCash}
                  disabled={submitting || cart.length === 0 || cashValue < total}
                  className="w-full mt-2 bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Memproses...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" /> Konfirmasi Bayar
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <div className="text-center py-2">
                  <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-bold">Pembayaran Berhasil</h3>
                  <p className="text-stone-400 text-sm mt-1">
                    Pesanan #{result.order.order_number} dikirim ke dapur
                  </p>
                </div>

                <div className="bg-stone-950 rounded-xl p-4 my-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Total</span>
                    <span className="font-bold">{formatRupiah(result.order.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Tunai</span>
                    <span>{formatRupiah(result.cash_received)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-stone-800">
                    <span className="text-stone-400">Kembalian</span>
                    <span className="font-bold text-green-500">
                      {formatRupiah(result.change)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={resetAll}
                    className="flex-1 bg-stone-800 hover:bg-stone-700 py-3 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <ReceiptText className="w-4 h-4" /> Transaksi Baru
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
