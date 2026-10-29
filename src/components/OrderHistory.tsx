'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Order } from '@/lib/types'
import { formatRupiah, formatModifiers } from '@/lib/utils'
import { getHistory } from '@/lib/order-history'
import { usePolling } from '@/lib/use-polling'
import { ChevronRight, ReceiptText } from 'lucide-react'

const STATUS_LABEL: Record<Order['status'], { label: string; className: string }> = {
  pending: { label: 'Menunggu bayar', className: 'bg-stone-700 text-stone-200' },
  paid: { label: 'Dibayar', className: 'bg-amber-500/20 text-amber-400' },
  preparing: { label: 'Diproses', className: 'bg-blue-500/20 text-blue-400' },
  ready: { label: 'Siap', className: 'bg-green-500/20 text-green-400' },
  served: { label: 'Diantar', className: 'bg-emerald-500/20 text-emerald-400' },
  completed: { label: 'Selesai', className: 'bg-emerald-500/20 text-emerald-400' },
  cancelled: { label: 'Dibatalkan', className: 'bg-red-500/20 text-red-400' },
}

export default function OrderHistory({ token, active }: { token: string; active: boolean }) {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[] | null>(null)

  const load = useCallback(async () => {
    const ids = getHistory(token)
    const results = await Promise.all(ids.map(async id => {
      try {
        const res = await fetch(`/api/orders/${id}`)
        return res.ok ? ((await res.json()).order as Order) : null
      } catch {
        return null
      }
    }))
    setOrders(results.filter((o): o is Order => o !== null))
  }, [token])

  useEffect(() => {
    if (active) load()
  }, [active, load])
  usePolling(load, 15000, active)

  if (orders === null) {
    return <p className="text-stone-500 text-center py-16">Memuat riwayat...</p>
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 text-stone-500">
        <ReceiptText className="w-10 h-10 mb-3 text-stone-600" />
        <p className="text-lg">Belum ada pesanan</p>
        <p className="text-sm mt-1 max-w-64">Pesanan yang kamu buat di meja ini akan muncul di sini</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-4">
      {orders.map(order => {
        const status = STATUS_LABEL[order.status] ?? STATUS_LABEL.pending
        return (
          <button
            key={order.id}
            onClick={() => router.push(`/order/${order.id}/status`)}
            className="w-full bg-stone-900 hover:bg-stone-800 rounded-2xl p-4 text-left"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold">Pesanan #{order.order_number}</p>
                <p className="text-stone-500 text-xs mt-0.5">
                  {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${status.className}`}>{status.label}</span>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-stone-300">
              {order.items?.map(item => (
                <li key={item.id}>
                  {item.quantity}x {item.menu_item_name}
                  {item.modifiers_json?.length > 0 && (
                    <span className="text-stone-500"> · {formatModifiers(item.modifiers_json).join(', ')}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-800">
              <span className="font-bold text-amber-500">{formatRupiah(order.total)}</span>
              <span className="text-stone-400 text-xs flex items-center">
                Lihat status <ChevronRight className="w-4 h-4" />
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
