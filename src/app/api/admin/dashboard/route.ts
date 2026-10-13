import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'

// GET /api/admin/dashboard - Sales dashboard aggregates (admin only via proxy)
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD   inclusive range, in WIB
//   &group=day|week|month             revenue bucket size
//   &payment=all|cash|qris            payment method filter
//   &source=all|table|walkin          QR-table orders vs POS walk-in
// Only orders with payment_status = 'paid' count as sales.

type Group = 'day' | 'week' | 'month'

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const PAGE = 1000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

interface PaidOrder {
  id: string
  table_id: string | null
  payment_method: string | null
  total: number
  created_at: string
  items: { menu_item_id: string | null; menu_item_name: string; quantity: number; item_total: number }[] | null
}

function isDate(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(`${s}T00:00:00Z`))
}

// Midnight WIB of a YYYY-MM-DD, as a UTC epoch
function wibMidnight(date: string) {
  return Date.parse(`${date}T00:00:00Z`) - WIB_OFFSET_MS
}

// A "WIB calendar" Date: its UTC getters read as WIB wall-clock
function toWib(ms: number) {
  return new Date(ms + WIB_OFFSET_MS)
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}

// Start (WIB calendar date) of the bucket containing d
function bucketStart(d: Date, group: Group) {
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  if (group === 'week') s.setUTCDate(s.getUTCDate() - ((s.getUTCDay() + 6) % 7)) // Monday
  if (group === 'month') s.setUTCDate(1)
  return s
}

function nextBucket(s: Date, group: Group) {
  const n = new Date(s)
  if (group === 'day') n.setUTCDate(n.getUTCDate() + 1)
  if (group === 'week') n.setUTCDate(n.getUTCDate() + 7)
  if (group === 'month') n.setUTCMonth(n.getUTCMonth() + 1)
  return n
}

function bucketLabel(s: Date, group: Group) {
  const dm = `${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]}`
  if (group === 'day') return dm
  if (group === 'week') return `Mg ${dm}`
  return `${MONTHS[s.getUTCMonth()]} ${s.getUTCFullYear()}`
}

function summarize(orders: PaidOrder[]) {
  const revenue = orders.reduce((s, o) => s + (o.total || 0), 0)
  const itemsSold = orders.reduce(
    (s, o) => s + (o.items || []).reduce((t, i) => t + (i.quantity || 0), 0),
    0
  )
  return {
    revenue,
    orders: orders.length,
    items_sold: itemsSold,
    avg_order: orders.length ? Math.round(revenue / orders.length) : 0,
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const group = (searchParams.get('group') || 'day') as Group
  const payment = searchParams.get('payment') || 'all'
  const source = searchParams.get('source') || 'all'

  if (!isDate(from) || !isDate(to)) {
    return NextResponse.json({ error: 'from & to wajib format YYYY-MM-DD' }, { status: 400 })
  }
  if (!['day', 'week', 'month'].includes(group)) {
    return NextResponse.json({ error: 'group harus day, week, atau month' }, { status: 400 })
  }

  const startMs = wibMidnight(from)
  const endMs = wibMidnight(to) + DAY_MS // exclusive
  if (endMs <= startMs) {
    return NextResponse.json({ error: 'Tanggal akhir harus setelah tanggal awal' }, { status: 400 })
  }
  if (endMs - startMs > 366 * DAY_MS) {
    return NextResponse.json({ error: 'Rentang maksimal 1 tahun' }, { status: 400 })
  }
  // Previous period of the same length, for the comparison numbers
  const prevStartMs = startMs - (endMs - startMs)

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  // Page through results; PostgREST caps each response at 1000 rows
  const rows: PaidOrder[] = []
  for (let offset = 0; ; offset += PAGE) {
    let query = supabase
      .from('orders')
      .select('id, table_id, payment_method, total, created_at, items:order_items(menu_item_id, menu_item_name, quantity, item_total)')
      .eq('payment_status', 'paid')
      .gte('created_at', new Date(prevStartMs).toISOString())
      .lt('created_at', new Date(endMs).toISOString())
      .order('created_at')
      .range(offset, offset + PAGE - 1)

    if (payment !== 'all') query = query.eq('payment_method', payment)
    if (source === 'table') query = query.not('table_id', 'is', null)
    if (source === 'walkin') query = query.is('table_id', null)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    rows.push(...((data || []) as PaidOrder[]))
    if (!data || data.length < PAGE) break
  }

  const current = rows.filter(o => Date.parse(o.created_at) >= startMs)
  const previous = rows.filter(o => Date.parse(o.created_at) < startMs)

  // Revenue series with empty buckets filled in
  const series = new Map<string, { key: string; label: string; revenue: number; orders: number }>()
  const lastBucket = bucketStart(toWib(endMs - 1), group)
  for (let s = bucketStart(toWib(startMs), group); s <= lastBucket; s = nextBucket(s, group)) {
    series.set(ymd(s), { key: ymd(s), label: bucketLabel(s, group), revenue: 0, orders: 0 })
  }
  for (const o of current) {
    const b = series.get(ymd(bucketStart(toWib(Date.parse(o.created_at)), group)))
    if (b) {
      b.revenue += o.total || 0
      b.orders += 1
    }
  }

  // Best sellers, keyed by menu id (falls back to the name snapshot for deleted menus)
  const menus = new Map<string, { name: string; quantity: number; revenue: number }>()
  for (const o of current) {
    for (const i of o.items || []) {
      const key = i.menu_item_id || `name:${i.menu_item_name}`
      const m = menus.get(key) || { name: i.menu_item_name, quantity: 0, revenue: 0 }
      m.quantity += i.quantity || 0
      m.revenue += i.item_total || 0
      menus.set(key, m)
    }
  }
  const topMenu = [...menus.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)

  // Split by payment method and by source
  const byPayment: Record<string, { orders: number; revenue: number }> = {}
  const bySource = { table: { orders: 0, revenue: 0 }, walkin: { orders: 0, revenue: 0 } }
  for (const o of current) {
    const p = o.payment_method || 'lainnya'
    byPayment[p] = byPayment[p] || { orders: 0, revenue: 0 }
    byPayment[p].orders += 1
    byPayment[p].revenue += o.total || 0
    const s = o.table_id ? bySource.table : bySource.walkin
    s.orders += 1
    s.revenue += o.total || 0
  }

  return NextResponse.json({
    range: { from, to, group },
    summary: summarize(current),
    previous: summarize(previous),
    series: [...series.values()],
    top_menu: topMenu,
    by_payment: byPayment,
    by_source: bySource,
  })
}
