import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'
import { generateOrderId } from '@/lib/utils'

// POST /api/orders - Create new order
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { table_id, items, notes } = body

  if (!table_id || !items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'table_id and items required' }, { status: 400 })
  }

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  // Validate quantities and gather IDs
  const menuIds = []
  const modifierIds: string[] = []
  
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      return NextResponse.json({ error: `Invalid quantity for item: ${item.menu_item_id}. Must be integer 1-99.` }, { status: 400 })
    }
    menuIds.push(item.menu_item_id)
    if (Array.isArray(item.modifiers)) {
      for (const m of item.modifiers) {
        if (!m.id) {
          return NextResponse.json({ error: `Modifier missing id for item: ${item.menu_item_id}` }, { status: 400 })
        }
        modifierIds.push(m.id)
      }
    }
  }

  // Fetch real prices and availability from DB
  const { data: dbItems, error: dbError } = await supabase
    .from('menu_items')
    .select('id, name, base_price, is_available, stock')
    .in('id', menuIds)

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // Fetch allowed modifier groups and their max_select limits
  const { data: allowedModsData, error: allowedError } = await supabase
    .from('menu_item_modifiers')
    .select('menu_item_id, modifier_group_id, modifier_groups(max_select)')
    .in('menu_item_id', menuIds)

  if (allowedError) {
    return NextResponse.json({ error: allowedError.message }, { status: 500 })
  }

  // Fetch modifier prices and their group_id
  let dbModifiers: any[] = []
  if (modifierIds.length > 0) {
    const { data: modData, error: modError } = await supabase
      .from('modifier_options')
      .select('id, name, price_add, group_id')
      .in('id', modifierIds)
    if (modError) {
      return NextResponse.json({ error: modError.message }, { status: 500 })
    }
    dbModifiers = modData || []
  }

  // Recalculate totals and check availability
  let subtotal = 0
  const validatedItems = []

  for (const item of items) {
    const dbItem = dbItems?.find(d => d.id === item.menu_item_id)
    
    if (!dbItem) {
      return NextResponse.json({ error: `Item not found: ${item.menu_item_name || item.menu_item_id}` }, { status: 400 })
    }
    
    if (!dbItem.is_available || (dbItem.stock !== -1 && dbItem.stock < item.quantity)) {
      return NextResponse.json({ error: `Item sold out or insufficient stock: ${dbItem.name}` }, { status: 400 })
    }

    const unit_price = dbItem.base_price
    const validatedModifiers: any[] = []
    let modifierTotal = 0
    
    if (Array.isArray(item.modifiers)) {
      const groupCounts: Record<string, number> = {}
      for (const mod of item.modifiers) {
        if (!mod.id) {
          return NextResponse.json({ error: 'Modifier missing id' }, { status: 400 })
        }
        const dbMod = dbModifiers.find(d => d.id === mod.id)
        if (dbMod) {
          // Check if this modifier group is allowed for this menu item
          const isAllowed = allowedModsData?.some(
            (am) => am.menu_item_id === item.menu_item_id && am.modifier_group_id === dbMod.group_id
          )
          
          if (!isAllowed) {
            return NextResponse.json({ error: `Modifier ${dbMod.name} is not allowed for item ${dbItem.name}` }, { status: 400 })
          }

          // We will count occurrences of each group_id later to ensure max_select is respected
          // Check max_select
          const am = allowedModsData?.find(a => a.menu_item_id === item.menu_item_id && a.modifier_group_id === dbMod.group_id)
          const maxSelect = (am?.modifier_groups as any)?.max_select || 1
          
          groupCounts[dbMod.group_id] = (groupCounts[dbMod.group_id] || 0) + 1
          if (groupCounts[dbMod.group_id] > maxSelect) {
            return NextResponse.json({ error: `Terlalu banyak modifier dipilih untuk satu grup pada item ${dbItem.name}` }, { status: 400 })
          }

          modifierTotal += dbMod.price_add
          validatedModifiers.push({
            id: dbMod.id,
            name: dbMod.name,
            price_add: dbMod.price_add
          })
        } else {
          return NextResponse.json({ error: `Modifier not found: ${mod.id}` }, { status: 400 })
        }
      }
    }
    
    const item_total = (unit_price + modifierTotal) * item.quantity
    subtotal += item_total

    validatedItems.push({
      menu_item_id: dbItem.id,
      menu_item_name: dbItem.name,
      quantity: item.quantity,
      unit_price: unit_price,
      modifiers_json: validatedModifiers,
      item_total: item_total,
      notes: item.notes || null,
    })
  }

  if (subtotal <= 0) {
    return NextResponse.json({ error: 'Total order must be greater than 0' }, { status: 400 })
  }

  // Create order and items in a single atomic transaction via RPC
  const { data: order, error: rpcError } = await supabase.rpc('create_order_transaction', {
    p_table_id: table_id,
    p_subtotal: subtotal,
    p_total: subtotal,
    p_notes: notes || null,
    p_midtrans_order_id: generateOrderId(),
    p_items: validatedItems
  })

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  return NextResponse.json({ order })
}

// GET /api/orders?table_id=xxx or ?status=preparing,ready (for KDS)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tableId = searchParams.get('table_id')
  const status = searchParams.get('status')

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  let query = supabase
    .from('orders')
    .select(`
      *,
      table:tables(*),
      items:order_items(*)
    `)
    .order('created_at', { ascending: false })

  if (tableId) {
    query = query.eq('table_id', tableId)
  }

  if (status) {
    query = query.in('status', status.split(','))
  }

  const { data: orders, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ orders })
}