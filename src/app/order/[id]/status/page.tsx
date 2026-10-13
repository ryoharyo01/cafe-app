'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePolling } from '@/lib/use-polling'
import { useParams, useRouter } from 'next/navigation'
import { Order } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import CoffeeWait, { CoffeeStage } from '@/components/CoffeeWait'
import { ArrowLeft, ChefHat, Check, Truck, Coffee, Loader2 } from 'lucide-react'

const STATUS_STEPS = [
  { key: 'paid', label: 'Dibayar', icon: Check, color: 'text-amber-500' },
  { key: 'preparing', label: 'Diproses', icon: ChefHat, color: 'text-blue-500' },
  { key: 'ready', label: 'Siap', icon: Coffee, color: 'text-green-500' },
  { key: 'served', label: 'Diantar', icon: Truck, color: 'text-emerald-500' },
]

// Order status -> coffee animation stage; 'completed' (set by KDS) looks the same as 'served'
function getCoffeeStage(status: string): CoffeeStage | null {
  if (status === 'completed') return 'served'
  return ['pending', 'paid', 'preparing', 'ready', 'served'].includes(status) ? (status as CoffeeStage) : null
}

function getStepIndex(status: string) {
  if (status === 'completed') return STATUS_STEPS.length - 1
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
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')

  async function payNow() {
    setPaying(true)
    setPayError('')
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      })
      const data = await res.json()
      if (!res.ok || !data.redirect_url) throw new Error(data.error || 'Gagal membuka pembayaran')
      window.location.href = data.redirect_url
    } catch (err: any) {
      setPayError(err.message)
      setPaying(false)
    }
  }

  const loadedRef = useRef(false)

  // Single-order endpoint — lighter than fetching the whole order list
  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, { cache: 'no-store' })
      if (!res.ok) {
        setError('Pesanan tidak ditemukan')
        return
      }
      const data = await res.json()
      loadedRef.current = true
      setOrder(data.order)
      setError('')
    } catch {
      // After the first load, keep showing the last known state; the next poll retries
      if (!loadedRef.current) setError('Gagal memuat pesanan')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  // Live updates: poll every 4s until the order reaches a final state
  const finished = !!order && ['served', 'completed', 'cancelled'].includes(order.status)
  usePolling(fetchOrder, 4000, !finished)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950 p-4">
        <CoffeeWait stage="loading" />
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
  const coffeeStage = getCoffeeStage(order.status)

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
            {coffeeStage && <CoffeeWait stage={coffeeStage} />}
            {order.status === 'pending' && order.payment_status !== 'paid' && (
              <div className="mt-5">
                <button
                  onClick={payNow}
                  disabled={paying}
                  className="w-full py-3 bg-amber-500 text-stone-950 font-bold rounded-xl hover:bg-amber-400 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {paying && <Loader2 className="w-5 h-5 animate-spin" />}
                  {paying ? 'Membuka pembayaran...' : `Bayar sekarang • ${formatRupiah(order.total)}`}
                </button>
                {payError && <p className="text-red-400 text-sm mt-2">{payError}</p>}
              </div>
            )}
            {order.status === 'cancelled' && (
              <p className="text-red-400 text-lg font-bold">Pesanan dibatalkan</p>
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
        {['served', 'completed'].includes(order.status) && order.table?.qr_token && (
          <button
            onClick={() => router.push(`/table/${order.table!.qr_token}`)}
            className="w-full py-4 bg-amber-500 text-stone-950 font-bold rounded-2xl text-lg hover:bg-amber-400"
          >
            Pesan Lagi ☕
          </button>
        )}
      </div>
    </div>
  )
}
