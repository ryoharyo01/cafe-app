import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/admin/menu/[id]/modifiers - groups attached to this menu item
export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  const { data, error } = await supabase
    .from('menu_item_modifiers')
    .select('modifier_group_id')
    .eq('menu_item_id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ group_ids: (data || []).map(r => r.modifier_group_id) })
}

// PUT /api/admin/menu/[id]/modifiers - replace the full set of attached groups
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await request.json()
  const groupIds: string[] = Array.isArray(body.group_ids) ? body.group_ids : null

  if (!groupIds) {
    return NextResponse.json({ error: 'group_ids (array) required' }, { status: 400 })
  }

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  // verify menu item exists
  const { data: item, error: itemErr } = await supabase
    .from('menu_items')
    .select('id')
    .eq('id', id)
    .single()

  if (itemErr || !item) {
    return NextResponse.json({ error: 'Menu item tidak ditemukan' }, { status: 404 })
  }

  // verify all groups exist (reject bad ids instead of silently ignoring)
  if (groupIds.length > 0) {
    const { data: found, error: gErr } = await supabase
      .from('modifier_groups')
      .select('id')
      .in('id', groupIds)

    if (gErr) {
      return NextResponse.json({ error: gErr.message }, { status: 500 })
    }
    if ((found || []).length !== groupIds.length) {
      return NextResponse.json({ error: 'Ada modifier group yang tidak ditemukan' }, { status: 400 })
    }
  }

  const { error: delErr } = await supabase
    .from('menu_item_modifiers')
    .delete()
    .eq('menu_item_id', id)

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  if (groupIds.length > 0) {
    const rows = groupIds.map(g => ({ menu_item_id: id, modifier_group_id: g }))
    const { error: insErr } = await supabase
      .from('menu_item_modifiers')
      .insert(rows)

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ group_ids: groupIds })
}
