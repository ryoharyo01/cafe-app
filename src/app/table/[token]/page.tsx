'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useCartStore } from '@/store/cart'
import { Category, MenuItem } from '@/lib/types'
import MenuList from '@/components/MenuList'
import Cart from '@/components/Cart'
import AIChat from '@/components/AIChat'
import { UtensilsCrossed, MessageCircle, ShoppingCart, Loader2, AlertCircle } from 'lucide-react'

type Tab = 'menu' | 'ai' | 'cart'

export default function TablePage() {
  const params = useParams()
  const token = params.token as string
  const setTable = useCartStore(s => s.setTable)
  const tableNumber = useCartStore(s => s.tableNumber)
  const itemCount = useCartStore(s => s.getItemCount())

  const [tab, setTab] = useState<Tab>('menu')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])

  useEffect(() => {
    async function init() {
      try {
        // Validate table
        const tableRes = await fetch(`/api/tables/validate?token=${token}`)
        const tableData = await tableRes.json()
        if (!tableRes.ok) {
          setError(tableData.error || 'QR tidak valid')
          setLoading(false)
          return
        }
        setTable(tableData.table.id, tableData.table.number)

        // Load menu
        const menuRes = await fetch('/api/menu')
        const menuData = await menuRes.json()
        setCategories(menuData.categories || [])
        setItems(menuData.items || [])
      } catch {
        setError('Gagal memuat data')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [token, setTable])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-950 p-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-red-400 text-lg font-semibold">{error}</p>
        <p className="text-stone-500 text-sm mt-2">Coba scan ulang QR code di meja</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="pb-24">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-stone-950 border-b border-stone-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">☕ Cafe</h1>
              <p className="text-stone-400 text-xs">Meja {tableNumber}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pt-4">
          {tab === 'menu' && <MenuList categories={categories} items={items} loading={loading} />}
          {/* Kept mounted (just hidden) so chat history and in-flight replies survive tab switches */}
          <div className={tab === 'ai' ? '' : 'hidden'}>
            <AIChat active={tab === 'ai'} />
          </div>
          {tab === 'cart' && <Cart />}
        </div>

        {/* Bottom Nav */}
        <div className="fixed bottom-0 left-0 right-0 bg-stone-900 border-t border-stone-800 z-20">
          <div className="max-w-md mx-auto flex">
            <NavButton
              active={tab === 'menu'}
              onClick={() => setTab('menu')}
              icon={UtensilsCrossed}
              label="Menu"
            />
            <NavButton
              active={tab === 'ai'}
              onClick={() => setTab('ai')}
              icon={MessageCircle}
              label="AI"
            />
            <NavButton
              active={tab === 'cart'}
              onClick={() => setTab('cart')}
              icon={ShoppingCart}
              label="Keranjang"
              badge={itemCount}
            />
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

function NavButton({
  active, onClick, icon: Icon, label, badge,
}: {
  active: boolean
  onClick: () => void
  icon: typeof UtensilsCrossed
  label: string
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center py-3 relative ${
        active ? 'text-amber-500' : 'text-stone-500'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-xs mt-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="absolute top-1 right-1/4 bg-amber-500 text-stone-950 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  )
}
