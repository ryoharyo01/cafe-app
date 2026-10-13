import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'
import { isDemoPayment } from '@/lib/payment'

// POST /api/payment/demo - Fake QRIS confirmation for demos.
// Only works while Midtrans keys are NOT set; once they are, this is disabled.
export async function POST(request: NextRequest) {
  if (!isDemoPayment()) {
    return NextResponse.json({ error: 'Mode demo nonaktif: pembayaran memakai Midtrans' }, { status: 403 })
  }

  const { order_id } = await request.json()
  if (!order_id) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 })
  }

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  // Conditional update: only a still-pending, unpaid order flips to paid, so a
  // double tap can't re-pay or revive an order the kitchen already moved on
  const { data, error } = await supabase
    .from('orders')
    .update({
      payment_status: 'paid',
      status: 'paid',
      payment_method: 'qris',
      updated_at: new Date().toISOString(),
    })
    .eq('id', order_id)
    .eq('status', 'pending')
    .neq('payment_status', 'paid')
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Pesanan sudah dibayar atau dibatalkan' }, { status: 409 })
  }

  return NextResponse.json({ success: true })
}
