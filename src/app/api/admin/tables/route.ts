import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// GET /api/admin/tables - List all tables with qr_token
export async function GET() {
  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  const { data: tables, error } = await supabase
    .from('tables')
    .select('*')
    .order('number')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tables })
}

// POST /api/admin/tables - Create new table
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { number } = body

  if (!number) {
    return NextResponse.json({ error: 'number is required' }, { status: 400 })
  }

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  // Generate a unique qr_token
  const qr_token = crypto.randomUUID()

  const { data, error } = await supabase
    .from('tables')
    .insert({
      number,
      qr_token,
      status: 'available',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ table: data }, { status: 201 })
}

// DELETE /api/admin/tables?id=xxx - Remove table (cascades orders/items)
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  const { error } = await supabase
    .from('tables')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}