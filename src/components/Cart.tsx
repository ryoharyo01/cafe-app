'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cart'
import { CartItem, MenuItem } from '@/lib/types'
import { formatRupiah, formatModifiers, maxOrderQty } from '@/lib/utils'
import { MenuPhoto, ItemModal } from '@/components/MenuList'
import { Plus, Minus, Trash2, Loader2, AlertTriangle, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { addToHistory } from '@/lib/order-history'

interface Props {
  menu: MenuItem[]
  onRefreshMenu: () => Promise<MenuItem[] | null>
}

// Masalah stok per menu: habis total, atau qty di keranjang melebihi sisa stok
type StockIssue = { menuItemId: string; name: string; left: number }

function findStockIssues(cartItems: CartItem[], menu: MenuItem[]): StockIssue[] {
  const qty: Record<string, { name: string; total: number }> = {}
  for (const item of cartItems) {
    const entry = qty[item.menu_item_id] ?? { name: item.menu_item_name, total: 0 }
    entry.total += item.quantity
    qty[item.menu_item_id] = entry
  }
  const issues: StockIssue[] = []
  for (const [id, { name, total }] of Object.entries(qty)) {
    const menuItem = menu.find(m => m.id === id)
    // Menu yang sudah dihapus dari daftar dianggap habis
    const left = menuItem ? maxOrderQty(menuItem) : 0
    if (total > left) issues.push({ menuItemId: id, name: menuItem?.name ?? name, left })
  }
  return issues
}

function describeIssues(issues: StockIssue[]) {
  return issues.map(i => (i.left > 0 ? `${i.name} (sisa ${i.left})` : i.name)).join(', ')
}

export default function Cart({ menu, onRefreshMenu }: Props) {
  const router = useRouter()
  const { token } = useParams<{ token: string }>()
  const { items, tableId, removeItem, updateQuantity, removeMenuItems, clearCart, getTotal } = useCartStore()
  const [loading, setLoading] = useState(false)
  // Baris keranjang yang sedang diubah (ganti modifier/catatan/qty)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const editMenuItem = editIndex != null ? menu.find(m => m.id === items[editIndex]?.menu_item_id) : undefined

  const issues = useMemo(() => findStockIssues(items, menu), [items, menu])
  const issueById = useMemo(() => new Map(issues.map(i => [i.menuItemId, i])), [issues])
  const soldOutIds = issues.filter(i => i.left === 0).map(i => i.menuItemId)

  // Cek stok terbaru setiap keranjang dibuka
  useEffect(() => {
    onRefreshMenu()
  }, [onRefreshMenu])

  // Alert setiap kali daftar menu bermasalah berubah (bukan tiap polling)
  const lastAlert = useRef('')
  useEffect(() => {
    const key = describeIssues(issues)
    if (key && key !== lastAlert.current) {
      toast.error(`Menu habis/stok kurang: ${key}`, { id: 'cart-stock', duration: 5000 })
    }
    lastAlert.current = key
  }, [issues])

  async function handleCheckout() {
    if (!tableId) {
      toast.error('Meja tidak valid')
      return
    }
    if (items.length === 0) return

    setLoading(true)
    try {
      // Validasi ulang dengan stok terbaru sebelum bikin order
      const freshMenu = await onRefreshMenu()
      if (freshMenu) {
        const freshIssues = findStockIssues(items, freshMenu)
        if (freshIssues.length > 0) {
          toast.error(`Menu habis/stok kurang: ${describeIssues(freshIssues)}`, { id: 'cart-stock' })
          return
        }
      }

      // Create order
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId, items }),
      })
      const orderData = await orderRes.json()
      if (!orderRes.ok) {
        // Stok berubah di antara refresh dan submit: refresh supaya item ditandai di keranjang
        if (orderRes.status === 409) onRefreshMenu()
        throw new Error(orderData.error)
      }
      addToHistory(token, orderData.order.id)

      // Create payment
      const payRes = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderData.order.id }),
      })
      const payData = await payRes.json()
      clearCart()
      if (!payRes.ok) {
        // The order already exists: retry from its status page instead of
        // creating a duplicate order on the next tap
        toast.error(payData.error || 'Gagal membuka pembayaran')
        router.push(`/order/${orderData.order.id}/status`)
        return
      }

      toast.success('Pesanan dibuat! Mengalihkan ke pembayaran...')

      // Redirect to Midtrans
      if (payData.redirect_url) {
        window.location.href = payData.redirect_url
      } else {
        router.push(`/order/${orderData.order.id}/status`)
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal membuat pesanan')
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-stone-500">
        <p className="text-lg">Keranjang kosong</p>
        <p className="text-sm mt-1">Pilih menu dulu ya ☕</p>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* Alert menu habis */}
      {issues.length > 0 && (
        <div role="alert" className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-300">Ada menu yang habis</p>
              <ul className="text-sm text-red-200/90 mt-1 space-y-0.5">
                {issues.map(i => (
                  <li key={i.menuItemId}>
                    • {i.name} {i.left > 0 ? `— sisa ${i.left}, kurangi jumlahnya` : '— habis'}
                  </li>
                ))}
              </ul>
              {soldOutIds.length > 0 && (
                <button
                  onClick={() => removeMenuItems(soldOutIds)}
                  className="mt-3 px-3 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-400"
                >
                  Hapus menu yang habis
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item, index) => {
          const issue = issueById.get(item.menu_item_id)
          const menuItem = menu.find(m => m.id === item.menu_item_id)
          const image = item.image_url ?? menuItem?.image_url
          // Batas + : sisa stok dikurangi qty menu yang sama di baris lain
          const otherQty = items.reduce(
            (sum, it, i) => (i !== index && it.menu_item_id === item.menu_item_id ? sum + it.quantity : sum), 0)
          const maxQty = menuItem ? maxOrderQty(menuItem) - otherQty : 0
          return (
            <div
              key={index}
              className={`bg-stone-900 rounded-2xl p-3 ${issue ? 'ring-1 ring-red-500/60' : ''}`}
            >
              <div className="flex gap-3">
                <div className="relative shrink-0">
                  <MenuPhoto
                    item={{ name: item.menu_item_name, image_url: image }}
                    className={`w-20 h-20 rounded-xl ${issue?.left === 0 ? 'grayscale opacity-40' : ''}`}
                  />
                  {issue?.left === 0 && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md -rotate-6">HABIS</span>
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{item.menu_item_name}</p>
                      {item.modifiers.length > 0 && (
                        <p className="text-stone-400 text-sm mt-0.5">
                          {formatModifiers(item.modifiers).join(', ')}
                        </p>
                      )}
                      {item.notes && <p className="text-stone-500 text-sm italic">"{item.notes}"</p>}
                      {issue && (
                        <p className="text-red-400 text-xs font-semibold mt-1">
                          {issue.left > 0 ? `Sisa stok ${issue.left}` : 'Sold out'}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {menuItem && issue?.left !== 0 && (
                        <button
                          onClick={() => setEditIndex(index)}
                          className="px-2 py-1 rounded-lg bg-stone-800 text-stone-200 text-xs font-medium flex items-center gap-1"
                          aria-label={`Ubah ${item.menu_item_name}`}
                        >
                          <Pencil className="w-3 h-3" /> Ubah
                        </button>
                      )}
                      <button onClick={() => removeItem(index)} className="p-1 text-red-400" aria-label="Hapus">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-2 bg-stone-800 rounded-xl px-1">
                      <button
                        onClick={() => updateQuantity(index, Math.max(1, item.quantity - 1))}
                        className="p-2"
                        aria-label="Kurangi"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-bold w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(index, item.quantity + 1)}
                        disabled={item.quantity >= maxQty}
                        className="p-2 disabled:opacity-30"
                        aria-label="Tambah"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="font-bold text-amber-500">{formatRupiah(item.item_total)}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {editMenuItem && editIndex != null && (
        <ItemModal item={editMenuItem} editIndex={editIndex} onClose={() => setEditIndex(null)} />
      )}

      {/* Checkout Bar */}
      <div className="fixed bottom-16 left-0 right-0 bg-stone-900 border-t border-stone-800 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-center mb-3">
            <span className="text-stone-400">Total</span>
            <span className="text-xl font-bold text-amber-500">{formatRupiah(getTotal())}</span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={loading || issues.length > 0}
            className="w-full py-4 bg-amber-500 text-stone-950 font-bold rounded-2xl text-lg hover:bg-amber-400 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {loading ? 'Memproses...' : issues.length > 0 ? 'Cek menu yang habis dulu' : 'Bayar QRIS'}
          </button>
        </div>
      </div>
    </div>
  )
}
