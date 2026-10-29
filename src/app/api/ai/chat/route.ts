import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { describeError, logError, logWarn } from '@/lib/logger'


// Urutan model: OPENAI_MODELS (dipisah koma) dicoba berurutan, fallback ke OPENAI_MODEL
function openaiModels() {
  const list = (process.env.OPENAI_MODELS || process.env.OPENAI_MODEL || 'gpt-4o-mini')
    .split(',')
    .map(m => m.trim())
    .filter(Boolean)
  return [...new Set(list)]
}

const ATTEMPT_TIMEOUT_MS = Number(process.env.AI_ATTEMPT_TIMEOUT_MS) || 10000
const TOTAL_TIMEOUT_MS = Number(process.env.AI_TOTAL_TIMEOUT_MS) || 30000
const FALLBACK_REPLY = 'Maaf, asisten lagi gangguan. Silakan pilih menu secara manual ya! 🙏'

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

  // Kalau tabel rate limit tidak bisa diakses, chat tetap jalan (fail-open)
  try {
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
  } catch (err) {
    await logWarn('ai.chat', `Rate limit check failed: ${describeError(err).message}`)
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
  const { data: items, error: menuError } = await supabase
    .from('menu_items')
    .select('name, slug, description, base_price, is_available, stock, category:categories(name)')
    .order('name')

  // Tanpa data menu AI bisa ngarang menu/harga, jadi jangan panggil AI
  if (menuError || !items || items.length === 0) {
    await logError('ai.chat', menuError || 'Menu kosong, AI tidak dipanggil')
    return NextResponse.json({
      reply: 'Maaf, asisten lagi nggak bisa lihat menu sekarang. Silakan pilih menu secara manual ya! 🙏',
    })
  }

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

  const systemPrompt = `Kamu adalah asisten cafe Kopi Nusantara yang ramah dan helpful. Nama kamu "Mas Kopi'i" ☕ (itu nama kamu, bukan nama cafe).
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
- Gunakan emoji secukupnya 😊
- Tulis teks biasa, jangan pakai markdown (heading #, tabel, link). Boleh **tebal** untuk nama menu, dan "- " untuk daftar`

  // Coba tiap model berurutan; pindah ke model berikutnya kalau error, timeout, atau balasan kosong
  const deadline = Date.now() + TOTAL_TIMEOUT_MS
  const failures: string[] = []
  for (const model of openaiModels()) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    try {
      const completion = await openai.chat.completions.create(
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          max_tokens: 500,
          temperature: 0.7,
        },
        { timeout: Math.min(ATTEMPT_TIMEOUT_MS, remaining), maxRetries: 0 },
      )

      const reply = completion.choices[0]?.message?.content?.trim()
      if (reply) return NextResponse.json({ reply })
      failures.push(`${model}: balasan kosong`)
    } catch (err: any) {
      failures.push(`${model}: ${err?.status || ''} ${err?.message || err}`.trim())
    }
  }

  // Satu log per request (bukan per model) supaya fallback antar model tidak bikin spam
  await logError('ai.chat', `Semua model gagal → fallback reply`, { failures })
  return NextResponse.json({ reply: FALLBACK_REPLY })
}