import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'

// GET /api/admin/menu - List ALL menu items (including unavailable)
export async function GET() {
  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  const { data: items, error } = await supabase
    .from('menu_items')
    .select(`
      *,
      category:categories(*),
      modifier_groups:menu_item_modifiers(
        modifier_group_id,
        group:modifier_groups(
          id, name, is_required, max_select,
          options:modifier_options(id, name, price_add, sort_order)
        )
      )
    `)
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ratakan bentuk nested jadi array modifier_groups yang rapi
  const flat = (items || []).map(it => ({
    ...it,
    modifier_groups: (it.modifier_groups || [])
      .map((r: { group: unknown }) => r.group)
      .filter(Boolean),
  }))

  return NextResponse.json({ items: flat })
}

// POST /api/admin/menu - Create menu item
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, slug, category_id, base_price, description, image_url, is_available, stock } = body

  if (!name || !category_id || base_price == null) {
    return NextResponse.json({ error: 'name, category_id, and base_price are required' }, { status: 400 })
  }

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  const { data, error } = await supabase
    .from('menu_items')
    .insert({
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
      category_id,
      base_price,
      description: description || null,
      image_url: image_url || null,
      is_available: is_available ?? true,
      stock: stock ?? -1,
    })
    .select(`*, category:categories(*)`)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item: data }, { status: 201 })
}

// PATCH /api/admin/menu - Update menu item (send { id, ...fields })
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  const { data, error } = await supabase
    .from('menu_items')
    .update(updates)
    .eq('id', id)
    .select(`*, category:categories(*)`)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item: data })
}

// DELETE /api/admin/menu - Delete menu item (send { id })
export async function DELETE(request: NextRequest) {
  const body = await request.json()
  const { id } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  const { error } = await supabase
    .from('menu_items')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}