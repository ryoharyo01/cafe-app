import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'

// POST /api/pos/orders/[id]/pay - Bayar tunai (admin/kasir saja).
// Body: { cash_received: number }
// Atomik: mengunci order (FOR UPDATE), menolak kalau sudah dibayar,
// menghitung kembalian. Hanya 'cash' — QRIS tetap lewat webhook Midtrans.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const cash = Number(body?.cash_received)

  if (!Number.isInteger(cash) || cash < 0) {
    return NextResponse.json({ error: 'cash_received harus bilangan bulat >= 0' }, { status: 400 })
  }

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }

  const { data, error } = await sb.client.rpc('pos_pay_cash', {
    p_order_id: id,
    p_cash_received: cash,
  })

  if (error) {
    const msg = error.message || ''
    if (msg.includes('ORDER_NOT_FOUND')) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
    }
    if (msg.includes('ORDER_ALREADY_SETTLED')) {
      const status = msg.split(':')[1]?.trim()
      return NextResponse.json(
        { error: `Pesanan sudah tidak berstatus belum bayar (status: ${status || 'unknown'})` },
        { status: 409 }
      )
    }
    if (msg.includes('ORDER_INSUFFICIENT_CASH')) {
      const required = Number(msg.split(':')[1]?.trim())
      return NextResponse.json(
        { error: 'Uang tunai kurang dari total', required: Number.isFinite(required) ? required : undefined },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json(data)
}
