import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/admin/modifier-groups/[id]/options - options of one group
export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  const { data: options, error } = await supabase
    .from('modifier_options')
    .select('*')
    .eq('group_id', id)
    .order('sort_order')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ options })
}

// POST /api/admin/modifier-groups/[id]/options - add option to group
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await request.json()
  const { name, price_add, sort_order } = body

  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Nama opsi wajib diisi' }, { status: 400 })
  }

  const price = Number(price_add)
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'price_add harus angka >= 0' }, { status: 400 })
  }

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  // auto sort_order = current max + 1
  let order = Number(sort_order)
  if (!Number.isFinite(order)) {
    const { data: existing } = await supabase
      .from('modifier_options')
      .select('sort_order')
      .eq('group_id', id)
      .order('sort_order', { ascending: false })
      .limit(1)
    order = (existing?.[0]?.sort_order ?? 0) + 1
  }

  const { data, error } = await supabase
    .from('modifier_options')
    .insert({
      group_id: id,
      name: name.trim(),
      price_add: price,
      sort_order: order,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ option: data }, { status: 201 })
}
