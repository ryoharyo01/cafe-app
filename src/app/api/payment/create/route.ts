import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'
import midtransClient from 'midtrans-client'

function isMidtransConfigured() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY
  const clientKey = process.env.MIDTRANS_CLIENT_KEY
  if (!serverKey || serverKey.startsWith('your-') || !clientKey || clientKey.startsWith('your-')) {
    return false
  }
  return true
}

function getSnap() {
  return new midtransClient.Snap({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY!,
    clientKey: process.env.MIDTRANS_CLIENT_KEY!,
  })
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
  if (!isMidtransConfigured()) {
    return NextResponse.json({ error: 'Midtrans belum dikonfigurasi: set MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY di .env.local' }, { status: 503 })
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

  const itemDetails = order.items.map((item: any) => ({
    id: item.menu_item_id,
    price: Math.round(item.item_total / item.quantity),
    quantity: item.quantity,
    name: item.menu_item_name.substring(0, 50),
  }))

  try {
    const transaction = await getSnap().createTransaction({
      transaction_details: {
        order_id: order.midtrans_order_id,
        gross_amount: order.total,
      },
      item_details: itemDetails,
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
    console.error('Midtrans error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}