import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/admin/modifier-options/[id] - update one option
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) updates.name = String(body.name).trim()
  if (body.price_add !== undefined) {
    const price = Number(body.price_add)
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'price_add harus angka >= 0' }, { status: 400 })
    }
    updates.price_add = price
  }
  if (body.sort_order !== undefined) updates.sort_order = Number(body.sort_order)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  const { data, error } = await supabase
    .from('modifier_options')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ option: data })
}

// DELETE /api/admin/modifier-options/[id]
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  const { error } = await supabase
    .from('modifier_options')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
