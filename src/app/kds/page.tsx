'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Order, OrderItem, SelectedModifier } from '@/lib/types'
import { cn } from '@/lib/utils'
import { usePolling } from '@/lib/use-polling'
import {
  ChefHat,
  Clock,
  ArrowRight,
  Flame,
  CheckCircle2,
  Truck,
  UtensilsCrossed,
  RefreshCw,
  Volume2,
  VolumeX,
} from 'lucide-react'

type KDSOrder = Order & {
  table?: { id: string; number: number }
  items?: OrderItem[]
}

function timeElapsed(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}d`
  const mins = Math.floor(diff / 60)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  return `${hrs}j ${mins % 60}m`
}

function isUrgent(dateStr: string): boolean {
  const mins = (Date.now() - new Date(dateStr).getTime()) / 60000
  return mins > 10
}

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'square'
    gain.gain.value = 0.15
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.stop(ctx.currentTime + 0.3)
    // second beep
    setTimeout(() => {
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.frequency.value = 1100
      osc2.type = 'square'
      gain2.gain.value = 0.15
      osc2.start()
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc2.stop(ctx.currentTime + 0.3)
    }, 150)
  } catch {
    // Audio not supported
  }
}

const STATUS_CONFIG = {
  paid: {
    label: 'Baru',
    color: 'amber',
    icon: Flame,
    action: 'Mulai',
    nextStatus: 'preparing' as const,
    bgCard: 'bg-amber-950/40 border-amber-700/50',
    bgHeader: 'bg-amber-900/50',
    headerText: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30',
    actionBtn: 'bg-amber-600 hover:bg-amber-500 text-white',
    columnBg: 'border-amber-800/30',
  },
  preparing: {
    label: 'Diproses',
    color: 'blue',
    icon: ChefHat,
    action: 'Selesai',
    nextStatus: 'ready' as const,
    bgCard: 'bg-blue-950/40 border-blue-700/50',
    bgHeader: 'bg-blue-900/50',
    headerText: 'text-blue-400',
    badge: 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30',
    actionBtn: 'bg-blue-600 hover:bg-blue-500 text-white',
    columnBg: 'border-blue-800/30',
  },
  ready: {
    label: 'Siap',
    color: 'green',
    icon: CheckCircle2,
    action: 'Diantar',
    nextStatus: 'served' as const,
    bgCard: 'bg-emerald-950/40 border-emerald-700/50',
    bgHeader: 'bg-emerald-900/50',
    headerText: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30',
    actionBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    columnBg: 'border-emerald-800/30',
  },
}

function OrderCard({
  order,
  config,
  onAction,
  isActing,
}: {
  order: KDSOrder
  config: (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG]
  onAction: (orderId: string, nextStatus: string) => void
  isActing: boolean
}) {
  const [elapsed, setElapsed] = useState(timeElapsed(order.created_at))
  const urgent = isUrgent(order.created_at)

  useEffect(() => {
    const timer = setInterval(() => setElapsed(timeElapsed(order.created_at)), 1000)
    return () => clearInterval(timer)
  }, [order.created_at])

  return (
    <div
      className={cn(
        'rounded-xl border transition-all',
        config.bgCard,
        urgent && order.status === 'paid' && 'ring-2 ring-red-500/60 animate-pulse'
      )}
    >
      {/* Header */}
      <div className={cn('flex items-center justify-between px-4 py-3 rounded-t-xl', config.bgHeader)}>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black text-white">#{order.order_number}</span>
          <span className={cn('text-sm font-semibold px-2 py-0.5 rounded-full', config.badge)}>
            {order.table?.number ? `Meja ${order.table.number}` : 'Walk-in'}
          </span>
        </div>
        <div className={cn('flex items-center gap-1.5 text-sm font-mono', urgent ? 'text-red-400' : 'text-stone-400')}>
          <Clock className="w-3.5 h-3.5" />
          {elapsed}
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3 space-y-2">
        {order.items?.map((item) => (
          <div key={item.id} className="flex items-start gap-2">
            <span className="text-lg font-bold text-white min-w-[2rem] text-right">
              {item.quantity}×
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-base leading-tight">{item.menu_item_name}</p>
              {item.modifiers_json && item.modifiers_json.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {(item.modifiers_json as SelectedModifier[]).map((mod, i) => (
                    <span key={i} className="text-xs bg-stone-700/60 text-stone-300 px-1.5 py-0.5 rounded">
                      {mod.name}
                    </span>
                  ))}
                </div>
              )}
              {item.notes && (
                <p className="text-xs text-amber-400/80 mt-0.5 italic">📝 {item.notes}</p>
              )}
            </div>
          </div>
        ))}
        {order.notes && (
          <div className="mt-2 pt-2 border-t border-stone-700/50">
            <p className="text-xs text-amber-400/80 italic">Catatan: {order.notes}</p>
          </div>
        )}
      </div>

      {/* Action */}
      <div className="px-4 pb-3">
        <button
          onClick={() => onAction(order.id, config.nextStatus)}
          disabled={isActing}
          className={cn(
            'w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95',
            config.actionBtn,
            isActing && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isActing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {config.action}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default function KDSPage() {
  const [orders, setOrders] = useState<KDSOrder[]>([])
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const prevOrderIdsRef = useRef<Set<string>>(new Set())

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?status=paid,preparing,ready', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const fetched: KDSOrder[] = data.orders || []

      // Detect new paid orders for audio notification
      const newPaidIds = new Set(fetched.filter((o) => o.status === 'paid').map((o) => o.id))
      const prevIds = prevOrderIdsRef.current
      if (prevIds.size > 0 && soundEnabled) {
        for (const id of newPaidIds) {
          if (!prevIds.has(id)) {
            playBeep()
            break
          }
        }
      }
      prevOrderIdsRef.current = new Set(fetched.map((o) => o.id))

      setOrders(fetched)
      setLastFetch(new Date())
    } catch {
      // silently retry next cycle
    }
  }, [soundEnabled])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // New and updated orders show up within ~4s
  usePolling(fetchOrders, 4000)

  const handleAction = async (orderId: string, nextStatus: string) => {
    setActingOn(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (res.ok) {
        // Optimistic: remove/move instantly then refetch
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus as KDSOrder['status'] } : o))
              .filter((o) => !['served', 'completed'].includes(o.status))
        )
        await fetchOrders()
      }
    } catch {
      // will refresh next cycle
    } finally {
      setActingOn(null)
    }
  }

  const paidOrders = orders.filter((o) => o.status === 'paid')
  const preparingOrders = orders.filter((o) => o.status === 'preparing')
  const readyOrders = orders.filter((o) => o.status === 'ready')

  const columns = [
    { key: 'paid' as const, orders: paidOrders },
    { key: 'preparing' as const, orders: preparingOrders },
    { key: 'ready' as const, orders: readyOrders },
  ]

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      {/* Top Bar */}
      <header className="bg-stone-900/80 border-b border-stone-800 px-6 py-3 flex items-center justify-between sticky top-0 z-50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <UtensilsCrossed className="w-6 h-6 text-amber-500" />
          <h1 className="text-xl font-black tracking-tight">Kitchen Display</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-sm text-stone-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> {paidOrders.length} Baru
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> {preparingOrders.length} Proses
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> {readyOrders.length} Siap
            </span>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-lg hover:bg-stone-800 transition-colors text-stone-400"
            title={soundEnabled ? 'Matikan suara' : 'Nyalakan suara'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          {lastFetch && (
            <span className="text-xs text-stone-500 font-mono">
              {lastFetch.toLocaleTimeString('id-ID')}
            </span>
          )}
        </div>
      </header>

      {/* 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 h-[calc(100vh-57px)]">
        {columns.map(({ key, orders: colOrders }) => {
          const config = STATUS_CONFIG[key]
          const Icon = config.icon
          return (
            <div
              key={key}
              className={cn(
                'flex flex-col border-r border-stone-800 last:border-r-0 overflow-hidden',
                config.columnBg
              )}
            >
              {/* Column Header */}
              <div className={cn('flex items-center justify-between px-4 py-3', config.bgHeader)}>
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-5 h-5', config.headerText)} />
                  <h2 className={cn('text-lg font-bold', config.headerText)}>{config.label}</h2>
                </div>
                <span
                  className={cn(
                    'text-sm font-bold px-2.5 py-0.5 rounded-full',
                    config.badge
                  )}
                >
                  {colOrders.length}
                </span>
              </div>

              {/* Scrollable Order Cards */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-stone-700">
                {colOrders.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-stone-600">
                    <Icon className="w-12 h-12 mb-2" />
                    <p className="text-sm">Tidak ada pesanan</p>
                  </div>
                )}
                {colOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    config={config}
                    onAction={handleAction}
                    isActing={actingOn === order.id}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}