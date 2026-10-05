import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'

// POST /api/pos/orders - Buat pesanan walk-in dari POS kasir (admin/kasir saja).
// Body: { items: [{ menu_item_id, quantity }], notes?: string }
// Harga TIDAK diambil dari client — RPC pos_create_order menghitung ulang dari DB.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const items = body?.items
  const notes = typeof body?.notes === 'string' ? body.notes : null

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Keranjang kosong' }, { status: 400 })
  }
  if (items.length > 100) {
    return NextResponse.json({ error: 'Terlalu banyak baris item (maks 100)' }, { status: 400 })
  }

  const payload: { menu_item_id: string; quantity: number }[] = []
  for (const raw of items) {
    const quantity = Number(raw?.quantity)
    if (!raw?.menu_item_id || typeof raw.menu_item_id !== 'string') {
      return NextResponse.json({ error: 'Setiap item butuh menu_item_id' }, { status: 400 })
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return NextResponse.json({ error: 'Kuantitas harus bilangan bulat 1-99' }, { status: 400 })
    }
    payload.push({ menu_item_id: raw.menu_item_id, quantity })
  }

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }

  const { data, error } = await sb.client.rpc('pos_create_order', {
    p_menu_items: payload,
    p_notes: notes,
  })

  if (error) {
    const msg = error.message || ''
    if (msg.includes('ORDER_EMPTY')) {
      return NextResponse.json({ error: 'Keranjang kosong' }, { status: 400 })
    }
    if (msg.includes('ORDER_BAD_QUANTITY')) {
      return NextResponse.json({ error: 'Kuantitas harus bilangan bulat 1-99' }, { status: 400 })
    }
    if (msg.includes('ORDER_ITEM_NOT_FOUND')) {
      return NextResponse.json({ error: 'Ada item yang tidak ditemukan di database' }, { status: 400 })
    }
    if (msg.includes('ORDER_ITEM_UNAVAILABLE')) {
      const name = msg.split(':')[1]?.trim()
      return NextResponse.json({ error: `Item sedang tidak tersedia${name ? `: ${name}` : ''}` }, { status: 400 })
    }
    if (msg.includes('ORDER_ITEM_NO_STOCK')) {
      const name = msg.split(':')[1]?.trim()
      return NextResponse.json({ error: `Stok tidak cukup${name ? `: ${name}` : ''}` }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ order: data }, { status: 201 })
}
