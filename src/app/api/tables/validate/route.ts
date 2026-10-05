import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'

// GET /api/tables/validate?token=xxx
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client
  const { data: table, error } = await supabase
    .from('tables')
    .select('*')
    .eq('qr_token', token)
    .single()

  // PGRST116 = no row matched; anything else means the database itself failed
  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Server sedang bermasalah, coba lagi sebentar lagi' }, { status: 503 })
  }
  if (!table) {
    return NextResponse.json({ error: 'Invalid or expired QR code' }, { status: 404 })
  }

  // Mark table as occupied
  await supabase
    .from('tables')
    .update({ status: 'occupied' })
    .eq('id', table.id)

  return NextResponse.json({ table })
}