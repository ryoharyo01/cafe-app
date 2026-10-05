import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'
import OpenAI from 'openai'


function openaiModel() {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini'
}

// POST /api/ai/chat - AI menu assistant
export async function POST(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (request.headers.get('x-real-ip') || 'unknown')
  const now = Date.now()

  const sb = await tryCreateServiceClient()
  if ('error' in sb) {
    return NextResponse.json({ error: sb.error }, { status: sb.status })
  }
  const supabase = sb.client

  // AI Chat Rate Limiting (e.g. max 10 messages per minute per IP)
  const MAX_MSGS = 10
  const RESET_MS = 60 * 1000

  const { data: rlData } = await supabase
    .from('ai_chat_limits')
    .select('*')
    .eq('ip', ip)
    .single()

  if (rlData && now < rlData.reset_at) {
    if (rlData.count >= MAX_MSGS) {
      return NextResponse.json({ error: 'Terlalu banyak request AI. Silakan coba lagi nanti.' }, { status: 429 })
    }
    await supabase.from('ai_chat_limits').update({ count: rlData.count + 1 }).eq('ip', ip)
  } else {
    // Reset or create
    if (rlData) {
      await supabase.from('ai_chat_limits').update({ count: 1, reset_at: now + RESET_MS }).eq('ip', ip)
    } else {
      await supabase.from('ai_chat_limits').insert({ ip, count: 1, reset_at: now + RESET_MS })
    }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.includes('your-')) {
    return NextResponse.json({ error: 'OpenAI belum dikonfigurasi: set OPENAI_API_KEY di .env.local' }, { status: 503 })
  }

  const openai = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  })

  const { message, table_id } = await request.json()

  if (!message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  // Fetch current menu with availability
  const { data: items } = await supabase
    .from('menu_items')
    .select('name, slug, description, base_price, is_available, stock, category:categories(name)')
    .order('name')

  const menuContext = items?.map(item => {
    const available = item.is_available && (item.stock === -1 || item.stock > 0)
    const cat = (item.category as any)?.name || 'Uncategorized'
    return `- ${item.name} (${cat}) - Rp${item.base_price.toLocaleString('id-ID')} ${available ? '✅' : '❌ SOLD OUT'}: ${item.description || ''}`
  }).join('\n')

  // Fetch active orders for this table (if provided)
  let orderContext = ''
  if (table_id) {
    const { data: orders } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('table_id', table_id)
      .in('status', ['pending', 'paid', 'preparing', 'ready'])
      .order('created_at', { ascending: false })
      .limit(3)

    if (orders && orders.length > 0) {
      orderContext = '\n\nPesanan aktif di meja ini:\n' + orders.map(o =>
        `Order #${o.order_number} (${o.status}): ${o.items?.map((i: any) => `${i.quantity}x ${i.menu_item_name}`).join(', ')}`
      ).join('\n')
    }
  }

  const systemPrompt = `Kamu adalah asisten cafe yang ramah dan helpful. Nama kamu "Kopi" ☕.
Kamu membantu pelanggan memilih menu, memberikan rekomendasi, dan menjawab pertanyaan tentang menu.

MENU YANG TERSEDIA:
${menuContext}
${orderContext}

RULES:
- Jawab dalam Bahasa Indonesia yang casual dan friendly
- Kalau item sold out, minta maaf dan rekomendasikan alternatif serupa
- Kalau diminta rekomendasi, tanya dulu preferensi mereka (suka manis/pahit, panas/dingin, dll)
- Sebutkan harga saat merekomendasikan
- Jangan buat menu yang tidak ada di daftar
- Jawab singkat dan to the point, max 2-3 paragraf
- Gunakan emoji secukupnya 😊`

  try {
    const completion = await openai.chat.completions.create({
      model: openaiModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      max_tokens: 500,
      temperature: 0.7,
    })

    const reply = completion.choices[0]?.message?.content || 'Maaf, aku lagi error nih 😅'

    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error('OpenAI error:', err)
    return NextResponse.json({
      reply: 'Maaf, asisten lagi gangguan. Silakan pilih menu secara manual ya! 🙏',
    })
  }
}