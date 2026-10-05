// ============================================
// Database Types
// ============================================

export interface Table {
  id: string
  number: number
  qr_token: string
  status: 'available' | 'occupied' | 'reserved'
  created_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  sort_order: number
}

export interface MenuItem {
  id: string
  category_id: string
  name: string
  slug: string
  description: string | null
  base_price: number
  image_url: string | null
  is_available: boolean
  stock: number
  created_at: string
  category?: Category
  modifier_groups?: ModifierGroup[]
}

export interface ModifierGroup {
  id: string
  name: string
  is_required: boolean
  max_select: number
  options: ModifierOption[]
}

export interface ModifierOption {
  id: string
  group_id: string
  name: string
  price_add: number
  sort_order: number
}

export interface Order {
  id: string
  table_id: string
  order_number: number
  status: 'pending' | 'paid' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled'
  payment_method: string | null
  payment_status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded'
  midtrans_order_id: string | null
  midtrans_transaction_id: string | null
  subtotal: number
  discount: number
  total: number
  notes: string | null
  created_at: string
  updated_at: string
  table?: Table
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  menu_item_name: string
  quantity: number
  unit_price: number
  modifiers_json: SelectedModifier[]
  item_total: number
  notes: string | null
}

export interface SelectedModifier {
  id: string;
  name: string
  group_name: string
  price_add: number
}

// Cart types (client-side)
export interface CartItem {
  menu_item_id: string
  menu_item_name: string
  quantity: number
  unit_price: number
  modifiers: SelectedModifier[]
  item_total: number
  notes: string
}

export interface CartState {
  items: CartItem[]
  tableId: string | null
  tableNumber: number | null
}