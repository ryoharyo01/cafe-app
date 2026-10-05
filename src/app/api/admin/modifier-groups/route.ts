import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'

// GET /api/admin/modifier-groups - all groups with options + which menu items use them
export async function GET() {
  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  const { data: groups, error } = await supabase
    .from('modifier_groups')
    .select(`
      *,
      options:modifier_options(*),
      menu_items:menu_item_modifiers(menu_item_id)
    `)
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ groups })
}

// POST /api/admin/modifier-groups - create group
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, is_required, max_select } = body

  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Nama grup wajib diisi' }, { status: 400 })
  }

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  const { data, error } = await supabase
    .from('modifier_groups')
    .insert({
      name: name.trim(),
      is_required: is_required ?? false,
      max_select: max_select ?? 1,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ group: data }, { status: 201 })
}
