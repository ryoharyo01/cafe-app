import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/admin/modifier-groups/[id] - update group
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) updates.name = String(body.name).trim()
  if (body.is_required !== undefined) updates.is_required = Boolean(body.is_required)
  if (body.max_select !== undefined) updates.max_select = Number(body.max_select)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  const { data, error } = await supabase
    .from('modifier_groups')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ group: data })
}

// DELETE /api/admin/modifier-groups/[id] - delete group (cascades options + links)
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  const { error } = await supabase
    .from('modifier_groups')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
