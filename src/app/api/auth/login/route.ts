import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/server'
import { createSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (request.headers.get('x-real-ip') || 'unknown')
  const now = Date.now()

  const sb = await tryCreateServiceClient()
  if ('error' in sb) return NextResponse.json({ error: sb.error }, { status: 503 })
  const supabase = sb.client

  // Rate limiting check via DB
  const { data: attemptData } = await supabase
    .from('login_attempts')
    .select('*')
    .eq('ip', ip)
    .single()

  if (attemptData && now < attemptData.reset_at) {
    if (attemptData.count >= 5) {
      return NextResponse.json({ error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' }, { status: 429 })
    }
  } else if (attemptData && now >= attemptData.reset_at) {
    // Reset if time passed
    await supabase.from('login_attempts').delete().eq('ip', ip)
  }

  const { pin } = await request.json()
  if (!pin) {
    return NextResponse.json({ error: 'PIN diperlukan' }, { status: 400 })
  }

  const { data: users, error } = await supabase
    .from('admin_users')
    .select('id, name, role, pin')

  if (error || !users || users.length === 0) {
    return NextResponse.json({ error: 'Sistem belum dikonfigurasi / tidak ada admin' }, { status: 500 })
  }

  let matchedUser = null
  for (const user of users) {
    if (user.pin.startsWith('$2a$') || user.pin.startsWith('$2b$')) {
      const match = await bcrypt.compare(pin, user.pin)
      if (match) {
        matchedUser = user
        break
      }
    }
  }

  if (!matchedUser) {
    // Increment rate limit in DB
    const nextResetAt = now + 15 * 60 * 1000
    if (attemptData && now < attemptData.reset_at) {
      await supabase
        .from('login_attempts')
        .update({ count: attemptData.count + 1 })
        .eq('ip', ip)
    } else {
      await supabase
        .from('login_attempts')
        .insert({ ip, count: 1, reset_at: nextResetAt })
    }

    return NextResponse.json({ error: 'PIN salah' }, { status: 401 })
  }

  // Login success, clear rate limit
  await supabase.from('login_attempts').delete().eq('ip', ip)

  await createSession({ id: matchedUser.id, role: matchedUser.role, name: matchedUser.name })
  
  return NextResponse.json({ success: true, user: { id: matchedUser.id, name: matchedUser.name, role: matchedUser.role } })
}
