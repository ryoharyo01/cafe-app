import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// POST /api/payment/webhook - Midtrans notification handler
export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    order_id,
    transaction_status,
    fraud_status,
    signature_key,
    status_code,
    gross_amount,
    transaction_id,
  } = body

  // Verify signature
  const serverKey = process.env.MIDTRANS_SERVER_KEY
  if (!serverKey || serverKey.startsWith('your-')) {
    return NextResponse.json({ error: 'Midtrans belum dikonfigurasi: set MIDTRANS_SERVER_KEY di .env.local' }, { status: 503 })
  }
  const expectedSignature = crypto
    .createHash('sha512')
    .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
    .digest('hex')

  if (signature_key !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  let paymentStatus = 'pending'
  let orderStatus = 'pending'

  if (transaction_status === 'capture' || transaction_status === 'settlement') {
    if (fraud_status === 'accept' || !fraud_status) {
      paymentStatus = 'paid'
      orderStatus = 'paid'
    }
  } else if (transaction_status === 'cancel' || transaction_status === 'deny' || transaction_status === 'expire') {
    paymentStatus = 'failed'
    orderStatus = 'cancelled'
  } else if (transaction_status === 'pending') {
    paymentStatus = 'pending'
  }

  // Find order by midtrans_order_id
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('midtrans_order_id', order_id)
    .single()

  if (order) {
    await supabase
      .from('orders')
      .update({
        payment_status: paymentStatus,
        status: orderStatus,
        midtrans_transaction_id: transaction_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
  }

  return NextResponse.json({ status: 'ok' })
}