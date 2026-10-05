import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'

// POST /api/pos/orders/[id]/cancel - Batalkan pesanan walk-in yang BELUM dibayar.
// Dipakai POS sebagai pembersih kalau pembayaran gagal setelah order terbuat.
// Hanya order pending+unpaid yang bisa dibatalkan; paid ditolak (harus void manual).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  const { data: order, error: readError } = await supabase
    .from('orders')
    .select('id, status, payment_status, table_id')
    .eq('id', id)
    .single()

  if (readError || !order) {
    return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
  }
  if (order.table_id !== null) {
    return NextResponse.json(
      { error: 'Hanya pesanan walk-in (POS) yang bisa dibatalkan lewat endpoint ini' },
      { status: 400 }
    )
  }
  if (order.status !== 'pending' || order.payment_status !== 'unpaid') {
    return NextResponse.json(
      { error: `Pesanan sudah tidak bisa dibatalkan (status: ${order.status}/${order.payment_status})` },
      { status: 409 }
    )
  }

  // Guard di klausa WHERE supaya tidak ada balapan dengan pembayaran.
  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .eq('payment_status', 'unpaid')
    .select()
    .maybeSingle()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: 'Pesanan berubah status saat dibatalkan — cek ulang' }, { status: 409 })
  }

  return NextResponse.json({ order: updated })
}
