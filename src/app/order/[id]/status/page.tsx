'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Order } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import { ArrowLeft, Clock, ChefHat, Check, Truck, Coffee, Loader2 } from 'lucide-react'

const STATUS_STEPS = [
  { key: 'paid', label: 'Dibayar', icon: Check, color: 'text-amber-500' },
  { key: 'preparing', label: 'Diproses', icon: ChefHat, color: 'text-blue-500' },
  { key: 'ready', label: 'Siap', icon: Coffee, color: 'text-green-500' },
  { key: 'served', label: 'Diantar', icon: Truck, color: 'text-emerald-500' },
]

function getStepIndex(status: string) {
  const idx = STATUS_STEPS.findIndex(s => s.key === status)
  return idx >= 0 ? idx : -1
}

export default function OrderStatusPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    // Single-order endpoint — lighter than fetching the whole order list
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${orderId}`)
        if (!res.ok) {
          setError('Pesanan tidak ditemukan')
          return
        }
        const data = await res.json()
        if (!cancelled) setOrder(data.order)
      } catch {
        if (!cancelled) setError('Gagal memuat pesanan')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchOrder()

    // Real-time: subscribe to this order's row
    let channel: any
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      channel = supabase
        .channel(`order-${orderId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${orderId}`,
          },
          (payload: any) => {
            setOrder((prev: Order | null) => (prev ? { ...prev, ...payload.new } : prev))
          }
        )
        .subscribe()
    })

    // Slow poll as a safety fallback (websocket may drop)
    const fallback = setInterval(fetchOrder, 30000)

    return () => {
      cancelled = true
      clearInterval(fallback)
      if (channel) {
        import('@/lib/supabase/client').then(({ createClient }) => {
          createClient().removeChannel(channel)
        })
      }
    }
  }, [orderId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-950 p-4">
        <p className="text-red-400 text-lg mb-4">{error || 'Pesanan tidak ditemukan'}</p>
        <button onClick={() => router.push('/')} className="text-amber-500 underline">
          Kembali
        </button>
      </div>
    )
  }

  const currentStep = getStepIndex(order.status)

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="max-w-md mx-auto p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Order #{order.order_number}</h1>
            <p className="text-stone-400 text-sm">
              Meja {order.table?.number || '-'} • {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Status Progress */}
        <div className="bg-stone-900 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-8">
            {STATUS_STEPS.map((step, i) => {
              const Icon = step.icon
              const isActive = i <= currentStep
              const isCurrent = i === currentStep
              return (
                <div key={step.key} className="flex flex-col items-center relative">
                  {i > 0 && (
                    <div className={`absolute top-5 -left-full w-full h-0.5 ${i <= currentStep ? 'bg-amber-500' : 'bg-stone-700'}`} />
                  )}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 ${
                    isCurrent ? 'bg-amber-500 animate-pulse-glow' : isActive ? 'bg-amber-500' : 'bg-stone-700'
                  }`}>
                    <Icon className={`w-5 h-5 ${isActive ? 'text-stone-950' : 'text-stone-400'}`} />
                  </div>
                  <span className={`text-xs mt-2 ${isActive ? 'text-amber-500 font-semibold' : 'text-stone-500'}`}>
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Current status message */}
          <div className="text-center">
            {order.status === 'paid' && (
              <p className="text-amber-400 flex items-center justify-center gap-2">
                <Clock className="w-5 h-5 animate-spin" /> Menunggu diproses barista...
              </p>
            )}
            {order.status === 'preparing' && (
              <p className="text-blue-400 flex items-center justify-center gap-2">
                <ChefHat className="w-5 h-5" /> Pesanan sedang dibuat ☕
              </p>
            )}
            {order.status === 'ready' && (
              <p className="text-green-400 flex items-center justify-center gap-2 text-lg font-bold">
                <Check className="w-6 h-6" /> Pesanan siap diantar! 🎉
              </p>
            )}
            {order.status === 'served' && (
              <p className="text-emerald-400 flex items-center justify-center gap-2 text-lg font-bold">
                <Check className="w-6 h-6" /> Pesanan sudah diantar. Selamat menikmati! 😊
              </p>
            )}
            {order.status === 'cancelled' && (
              <p className="text-red-400 text-lg font-bold">Pesanan dibatalkan</p>
            )}
            {order.status === 'pending' && (
              <p className="text-stone-400 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Menunggu pembayaran...
              </p>
            )}
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-stone-900 rounded-2xl p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Detail Pesanan</h2>
          <div className="space-y-3">
            {order.items?.map((item) => (
              <div key={item.id} className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{item.quantity}x {item.menu_item_name}</p>
                  {item.modifiers_json && (item.modifiers_json as any[]).length > 0 && (
                    <p className="text-stone-400 text-sm">
                      {(item.modifiers_json as any[]).map((m: any) => m.name).join(', ')}
                    </p>
                  )}
                  {item.notes && <p className="text-stone-500 text-sm italic">"{item.notes}"</p>}
                </div>
                <p className="text-stone-300 text-sm whitespace-nowrap">{formatRupiah(item.item_total)}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-stone-800 mt-4 pt-3 flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-amber-500">{formatRupiah(order.total)}</span>
          </div>
        </div>

        {/* Pesan Lagi */}
        {['served', 'completed'].includes(order.status) && order.table_id && (
          <button
            onClick={() => router.push(`/table/demo`)}
            className="w-full py-4 bg-amber-500 text-stone-950 font-bold rounded-2xl text-lg hover:bg-amber-400"
          >
            Pesan Lagi ☕
          </button>
        )}
      </div>
    </div>
  )
}
