import { NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'

// GET /api/pos/menu - Katalog menu untuk POS kasir (admin & kasir).
// Bentuknya sengaja ringkas: hanya field yang dibutuhkan layar kasir.
export async function GET() {
  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }

  const { data, error } = await sb.client
    .from('menu_items')
    .select('id, name, base_price, is_available, stock, category_id, category:categories(id, name), sort_order:created_at')
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data || [] })
}
