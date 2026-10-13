'use client'

// Fake QRIS payment page used while Midtrans isn't configured (demo mode).
// Looks like a QRIS checkout; "Simulasikan bayar" marks the order paid.

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { QRCode } from 'react-qrcode-logo'
import { Order } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import CoffeeWait from '@/components/CoffeeWait'
import { CheckCircle2, Loader2, ShieldCheck, TimerOff } from 'lucide-react'

const EXPIRES_IN_S = 15 * 60

type Phase = 'waiting' | 'verifying' | 'success' | 'expired'

export default function DemoPayPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<Phase>('waiting')
  const [left, setLeft] = useState(EXPIRES_IN_S)

  useEffect(() => {
    fetch(`/api/orders/${orderId}`)
      .then(r => r.json())
      .then(d => {
        if (!d.order) return setError(d.error || 'Pesanan tidak ditemukan')
        // Already paid or cancelled: nothing to pay here
        if (d.order.status !== 'pending') return router.replace(`/order/${orderId}/status`)
        setOrder(d.order)
      })
      .catch(() => setError('Gagal memuat pesanan'))
  }, [orderId, router])

  useEffect(() => {
    if (phase !== 'waiting') return
    const t = setInterval(() => {
      setLeft(s => {
        if (s <= 1) {
          setPhase('expired')
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [phase])

  async function simulatePay() {
    setPhase('verifying')
    setError('')
    // Short pause so it feels like a bank confirmation
    await new Promise(r => setTimeout(r, 1500))
    try {
      const res = await fetch('/api/payment/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Pembayaran gagal')
      setPhase('success')
      setTimeout(() => router.replace(`/order/${orderId}/status`), 1500)
    } catch (err: any) {
      setError(err.message)
      setPhase('waiting')
    }
  }

  if (error && !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-950 p-4 text-center">
        <p className="text-red-400 text-lg mb-4">{error}</p>
        <button onClick={() => router.push(`/order/${orderId}/status`)} className="text-amber-500 underline">
          Kembali
        </button>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950 p-4">
        <CoffeeWait stage="loading" />
      </div>
    )
  }

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs text-center rounded-xl px-3 py-2 mb-4">
          MODE DEMO: pembayaran disimulasikan, tidak ada uang yang ditarik
        </div>

        <div className="bg-white text-zinc-900 rounded-2xl overflow-hidden shadow-xl">
          <div className="bg-red-600 text-white px-5 py-3 flex items-center justify-between">
            <span className="font-black tracking-wider text-lg">QRIS</span>
            <span className="text-xs opacity-90">Order #{order.order_number}</span>
          </div>

          <div className="p-5 text-center">
            <p className="text-zinc-500 text-sm">☕ Cafe{order.table?.number ? ` • Meja ${order.table.number}` : ''}</p>
            <p className="text-3xl font-bold mt-1">{formatRupiah(order.total)}</p>

            <div className="relative mx-auto my-4 w-fit">
              <div className={phase === 'waiting' ? '' : 'opacity-20'}>
                <QRCode
                  value={`DEMO-QRIS|${order.midtrans_order_id || order.id}|${order.total}`}
                  size={200}
                  quietZone={8}
                  ecLevel="M"
                />
              </div>
              {phase === 'verifying' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Loader2 className="w-10 h-10 animate-spin text-zinc-700" />
                  <p className="text-sm font-medium mt-2">Memverifikasi pembayaran...</p>
                </div>
              )}
              {phase === 'success' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center animate-slide-in">
                  <CheckCircle2 className="w-16 h-16 text-green-600" />
                  <p className="font-bold text-green-700 mt-2">Pembayaran berhasil</p>
                </div>
              )}
              {phase === 'expired' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <TimerOff className="w-10 h-10 text-zinc-500" />
                  <p className="text-sm font-medium mt-2">QR kedaluwarsa</p>
                </div>
              )}
            </div>

            {phase === 'waiting' && (
              <p className="text-sm text-zinc-500">
                Scan pakai e-wallet / m-banking • berlaku <span className="font-mono font-semibold text-zinc-800">{mm}:{ss}</span>
              </p>
            )}
            <p className="text-[11px] text-zinc-400 mt-3 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> GoPay • OVO • DANA • ShopeePay • m-Banking
            </p>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm text-center mt-3">{error}</p>}

        {phase === 'waiting' && (
          <button
            onClick={simulatePay}
            className="w-full mt-5 py-4 bg-green-600 text-white font-bold rounded-2xl text-lg hover:bg-green-500"
          >
            Simulasikan bayar berhasil
          </button>
        )}
        {phase === 'expired' && (
          <button
            onClick={() => { setLeft(EXPIRES_IN_S); setPhase('waiting') }}
            className="w-full mt-5 py-4 bg-amber-500 text-stone-950 font-bold rounded-2xl text-lg hover:bg-amber-400"
          >
            Buat QR baru
          </button>
        )}
        {(phase === 'waiting' || phase === 'expired') && (
          <button
            onClick={() => router.push(`/order/${orderId}/status`)}
            className="w-full mt-3 py-3 text-stone-400 hover:text-stone-200 text-sm"
          >
            Bayar nanti
          </button>
        )}
      </div>
    </div>
  )
}
