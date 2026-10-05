'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cart'
import { formatRupiah } from '@/lib/utils'
import { Plus, Minus, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Cart() {
  const router = useRouter()
  const { items, tableId, removeItem, updateQuantity, clearCart, getTotal } = useCartStore()
  const [loading, setLoading] = useState(false)

  async function handleCheckout() {
    if (!tableId) {
      toast.error('Meja tidak valid')
      return
    }
    if (items.length === 0) return

    setLoading(true)
    try {
      // Create order
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId, items }),
      })
      const orderData = await orderRes.json()
      if (!orderRes.ok) throw new Error(orderData.error)

      // Create payment
      const payRes = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderData.order.id }),
      })
      const payData = await payRes.json()
      if (!payRes.ok) throw new Error(payData.error)

      clearCart()
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
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="bg-stone-900 rounded-2xl p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-semibold">{item.menu_item_name}</p>
                {item.modifiers.length > 0 && (
                  <p className="text-stone-400 text-sm mt-1">
                    {item.modifiers.map(m => m.name).join(', ')}
                  </p>
                )}
                {item.notes && <p className="text-stone-500 text-sm italic">"{item.notes}"</p>}
              </div>
              <button onClick={() => removeItem(index)} className="p-1 text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-between items-center mt-3">
              <div className="flex items-center gap-2 bg-stone-800 rounded-xl px-1">
                <button onClick={() => updateQuantity(index, Math.max(1, item.quantity - 1))} className="p-2">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-bold w-6 text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(index, item.quantity + 1)} className="p-2">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="font-bold text-amber-500">{formatRupiah(item.item_total)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Checkout Bar */}
      <div className="fixed bottom-16 left-0 right-0 bg-stone-900 border-t border-stone-800 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-center mb-3">
            <span className="text-stone-400">Total</span>
            <span className="text-xl font-bold text-amber-500">{formatRupiah(getTotal())}</span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full py-4 bg-amber-500 text-stone-950 font-bold rounded-2xl text-lg hover:bg-amber-400 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {loading ? 'Memproses...' : 'Bayar QRIS'}
          </button>
        </div>
      </div>
    </div>
  )
}
