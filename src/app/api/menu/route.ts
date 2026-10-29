import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'

// GET /api/menu - Get all menu items with categories and modifiers
export async function GET(request: NextRequest) {
  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  // Get categories
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')

  // Get menu items (termasuk yang tidak tersedia, ditampilkan sebagai "Habis" di menu)
  let query = supabase
    .from('menu_items')
    .select(`
      *,
      category:categories(*)
    `)
    .order('name')

  if (category && category !== 'all') {
    const cat = categories?.find(c => c.slug === category)
    if (cat) query = query.eq('category_id', cat.id)
  }

  const { data: items, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get modifier groups and options for each item
  const itemIds = items?.map(i => i.id) || []
  
  const { data: itemModifiers } = await supabase
    .from('menu_item_modifiers')
    .select('menu_item_id, modifier_group_id')
    .in('menu_item_id', itemIds)

  const groupIds = [...new Set(itemModifiers?.map(im => im.modifier_group_id) || [])]
  
  const { data: groups } = await supabase
    .from('modifier_groups')
    .select('*')
    .in('id', groupIds.length > 0 ? groupIds : ['none'])

  const { data: options } = await supabase
    .from('modifier_options')
    .select('*')
    .in('group_id', groupIds.length > 0 ? groupIds : ['none'])
    .order('sort_order')

  // Assemble modifier groups with options
  const groupsWithOptions = groups?.map(g => ({
    ...g,
    options: options?.filter(o => o.group_id === g.id) || [],
  })) || []

  // Attach modifiers to items
  const enrichedItems = items?.map(item => ({
    ...item,
    modifier_groups: itemModifiers
      ?.filter(im => im.menu_item_id === item.id)
      .map(im => groupsWithOptions.find(g => g.id === im.modifier_group_id))
      .filter(Boolean) || [],
  }))

  return NextResponse.json({ categories, items: enrichedItems })
}