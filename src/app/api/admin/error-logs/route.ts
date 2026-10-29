import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'

const RETENTION_DAYS = 30

// GET /api/admin/error-logs?source=server|client&level=error|warn&q=teks - error terbaru (admin only, dijaga proxy)
export async function GET(request: NextRequest) {
  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  // Buang log lama supaya tabel tidak terus membesar
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  await supabase.from('error_logs').delete().lt('created_at', cutoff)

  const params = request.nextUrl.searchParams
  let query = supabase
    .from('error_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const source = params.get('source')
  if (source === 'server' || source === 'client') query = query.eq('source', source)
  const level = params.get('level')
  if (level === 'error' || level === 'warn') query = query.eq('level', level)
  const q = params.get('q')?.trim()
  if (q) {
    const term = q.replace(/[%,()]/g, ' ')
    query = query.or(`message.ilike.%${term}%,context.ilike.%${term}%`)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: `Gagal memuat error log: ${error.message}` }, { status: 500 })
  }
  return NextResponse.json({ logs: data })
}

// DELETE /api/admin/error-logs - kosongkan semua log
export async function DELETE() {
  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const { error } = await sb.client.from('error_logs').delete().gte('id', 0)
  if (error) {
    return NextResponse.json({ error: `Gagal menghapus: ${error.message}` }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
