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
    return NextResponse.json({ error: 'Midtrans belum dikonfigurasi: set MIDTRANS_SERVER_KEY di server env' }, { status: 503 })
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

  // Each payment attempt sends "<midtrans_order_id>-P<suffix>" (see payment/create);
  // strip the suffix to find the order. Plain ids from older orders still match.
  const baseOrderId = String(order_id).replace(/-P[0-9A-Z]+$/, '')

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, payment_status, total')
    .eq('midtrans_order_id', baseOrderId)
    .single()

  if (!order) {
    return NextResponse.json({ status: 'ignored: order not found' })
  }
  if (Math.round(Number(gross_amount)) !== order.total) {
    console.error('Midtrans amount mismatch', { order_id, gross_amount, total: order.total })
    return NextResponse.json({ status: 'ignored: amount mismatch' })
  }
  // Midtrans retries and can deliver out of order: once paid (or moved on by the
  // kitchen / cancelled by staff) an order must not be pushed back. The one
  // exception: a payment that succeeds after an older attempt expired revives
  // the order, since the customer did pay.
  const cancelledByPayment = order.status === 'cancelled' && order.payment_status === 'failed'
  const open = order.status === 'pending' || (cancelledByPayment && paymentStatus === 'paid')
  if (order.payment_status === 'paid' || !open) {
    return NextResponse.json({ status: 'ok' })
  }

  await supabase
    .from('orders')
    .update({
      payment_status: paymentStatus,
      status: orderStatus,
      midtrans_transaction_id: transaction_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  return NextResponse.json({ status: 'ok' })
}
