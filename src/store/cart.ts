'use client'
import { create } from 'zustand'
import { CartItem, SelectedModifier } from '@/lib/types'

interface CartStore {
  items: CartItem[]
  tableId: string | null
  tableNumber: number | null
  setTable: (id: string, number: number) => void
  addItem: (item: Omit<CartItem, 'item_total'>) => void
  removeItem: (index: number) => void
  updateQuantity: (index: number, qty: number) => void
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
}

function calcItemTotal(item: { unit_price: number; modifiers: SelectedModifier[]; quantity: number }) {
  const modPrice = item.modifiers.reduce((sum, m) => sum + m.price_add, 0)
  return (item.unit_price + modPrice) * item.quantity
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  tableId: null,
  tableNumber: null,

  setTable: (id, number) => set({ tableId: id, tableNumber: number }),

  addItem: (item) => {
    const newItem: CartItem = {
      ...item,
      item_total: calcItemTotal(item),
    }
    set((state) => ({ items: [...state.items, newItem] }))
  },

  removeItem: (index) =>
    set((state) => ({ items: state.items.filter((_, i) => i !== index) })),

  updateQuantity: (index, qty) =>
    set((state) => ({
      items: state.items.map((item, i) =>
        i === index
          ? { ...item, quantity: qty, item_total: calcItemTotal({ ...item, quantity: qty }) }
          : item
      ),
    })),

  clearCart: () => set({ items: [] }),

  getTotal: () => get().items.reduce((sum, item) => sum + item.item_total, 0),
  getItemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
}))
