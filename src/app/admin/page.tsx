'use client'

import { useEffect, useState } from 'react'
import { Order, MenuItem } from '@/lib/types'
import { formatRupiah } from '@/lib/utils'
import MasterMenu from '@/components/MasterMenu'
import MasterQR from '@/components/MasterQR'
import POS from '@/components/POS'
import { BarChart3, UtensilsCrossed, QrCode as QrIcon, ClipboardList, Loader2, Banknote } from 'lucide-react'

type Tab = 'pos' | 'overview' | 'master-menu' | 'master-qr' | 'orders'

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('pos')
  const [orders, setOrders] = useState<Order[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [ordersRes, menuRes] = await Promise.all([
          fetch('/api/orders?status=pending,paid,preparing,ready,served,completed,cancelled'),
          fetch('/api/admin/menu'),
        ])
        const ordersData = await ordersRes.json()
        const menuData = await menuRes.json()
        setOrders(ordersData.orders || [])
        setMenuItems(menuData.items || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const today = new Date().toDateString()
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today)
  const todayRevenue = todayOrders.filter(o => o.payment_status === 'paid').reduce((s, o) => s + o.total, 0)

  const tabs: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
    { key: 'pos', label: 'Kasir (POS)', icon: Banknote },
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'master-menu', label: 'Master Menu', icon: UtensilsCrossed },
    { key: 'master-qr', label: 'Master QR', icon: QrIcon },
    { key: 'orders', label: 'Orders', icon: ClipboardList },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Top Nav */}
      <div className="border-b border-stone-800 bg-stone-900 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2 overflow-x-auto">
          <span className="text-amber-500 font-bold text-lg mr-4 whitespace-nowrap">☕ Admin</span>
          {tabs.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${
                  tab === t.key ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* POS KASIR */}
        {tab === 'pos' && <POS />}

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Hari Ini</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-stone-900 rounded-2xl p-5">
                <p className="text-stone-400 text-sm">Total Pesanan</p>
                <p className="text-3xl font-bold text-amber-500">{todayOrders.length}</p>
              </div>
              <div className="bg-stone-900 rounded-2xl p-5">
                <p className="text-stone-400 text-sm">Revenue</p>
                <p className="text-3xl font-bold text-green-500">{formatRupiah(todayRevenue)}</p>
              </div>
              <div className="bg-stone-900 rounded-2xl p-5">
                <p className="text-stone-400 text-sm">Menu Aktif</p>
                <p className="text-3xl font-bold">{menuItems.filter(m => m.is_available).length}</p>
              </div>
            </div>
          </div>
        )}

        {/* MASTER MENU */}
        {tab === 'master-menu' && <MasterMenu />}

        {/* MASTER QR */}
        {tab === 'master-qr' && <MasterQR />}


        {/* ORDERS */}
        {tab === 'orders' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Semua Pesanan ({orders.length})</h2>
            <div className="space-y-2">
              {orders.map(order => (
                <div key={order.id} className="bg-stone-900 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">#{order.order_number} • Meja {order.table?.number || '-'}</p>
                    <p className="text-stone-400 text-sm">
                      {new Date(order.created_at).toLocaleString('id-ID')} • {order.items?.length || 0} item
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-amber-500">{formatRupiah(order.total)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      order.status === 'paid' ? 'bg-amber-500/20 text-amber-400' :
                      order.status === 'preparing' ? 'bg-blue-500/20 text-blue-400' :
                      order.status === 'ready' ? 'bg-green-500/20 text-green-400' :
                      order.status === 'served' || order.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                      order.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                      'bg-stone-700 text-stone-300'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
              {orders.length === 0 && <p className="text-stone-500 text-center py-8">Belum ada pesanan</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}