import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'
import midtransClient from 'midtrans-client'
import { isDemoPayment } from '@/lib/payment'

function getSnap() {
  const snap = new midtransClient.Snap({
    // Sandbox unless explicitly switched to production
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY!,
    clientKey: process.env.MIDTRANS_CLIENT_KEY!,
  })
  // Point notifications at this deployment, so it works without setting the
  // Payment Notification URL in the Midtrans dashboard
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    snap.httpClient.http_client.defaults.headers.common['X-Override-Notification'] =
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/webhook`
  }
  return snap
}

// Midtrans rejects the request unless sum(price * quantity) === gross_amount,
// so lines that don't divide evenly are sent as one line and discounts as a negative line
function buildItemDetails(order: any) {
  const lines = order.items.map((item: any) => {
    const even = item.item_total % item.quantity === 0
    return {
      id: item.menu_item_id || 'item',
      price: even ? item.item_total / item.quantity : item.item_total,
      quantity: even ? item.quantity : 1,
      name: (even ? item.menu_item_name : `${item.quantity}x ${item.menu_item_name}`).substring(0, 50),
    }
  })
  if (order.discount > 0) {
    lines.push({ id: 'discount', price: -order.discount, quantity: 1, name: 'Diskon' })
  }
  const sum = lines.reduce((s: number, l: any) => s + l.price * l.quantity, 0)
  return sum === order.total ? lines : undefined
}

// POST /api/payment/create - Create Midtrans transaction
export async function POST(request: NextRequest) {
  const { order_id } = await request.json()
  if (!order_id) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 })
  }

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  const { data: order, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*), table:tables(*)')
    .eq('id', order_id)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.payment_status === 'paid' || order.status !== 'pending') {
    return NextResponse.json({ error: 'Pesanan ini sudah dibayar atau dibatalkan' }, { status: 409 })
  }

  // No Midtrans keys: send the customer to the fake QRIS page instead
  if (isDemoPayment()) {
    await supabase
      .from('orders')
      .update({ payment_status: 'pending', payment_method: 'qris' })
      .eq('id', order_id)
    return NextResponse.json({ redirect_url: `/pay/demo/${order.id}`, demo: true })
  }

  try {
    const transaction = await getSnap().createTransaction({
      transaction_details: {
        // Fresh id per attempt: Midtrans refuses a reused order_id, which would
        // block "bayar lagi". The webhook strips the suffix to find the order.
        order_id: `${order.midtrans_order_id}-P${Date.now().toString(36).toUpperCase()}`,
        gross_amount: order.total,
      },
      item_details: buildItemDetails(order),
      enabled_payments: ['gopay', 'shopeepay', 'other_qris'],
      callbacks: {
        finish: `${process.env.NEXT_PUBLIC_BASE_URL}/order/${order.id}/status`,
      },
    })

    // Update order with payment pending status
    await supabase
      .from('orders')
      .update({ payment_status: 'pending', payment_method: 'qris' })
      .eq('id', order_id)

    return NextResponse.json({
      token: transaction.token,
      redirect_url: transaction.redirect_url,
    })
  } catch (err: any) {
    console.error('Midtrans error:', err?.ApiResponse || err)
    return NextResponse.json({ error: 'Gagal membuat pembayaran. Coba lagi sebentar.' }, { status: 502 })
  }
}
