import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function isValidUrl(value?: string) {
  if (!value) return false
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Guard: hindari crash 500 saat env Supabase masih placeholder / kosong.
 * Balikan null kalau belum dikonfigurasi — caller cek null dan balas error JSON.
 */
export async function tryCreateServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!isValidUrl(url)) {
    return { error: 'Supabase belum dikonfigurasi: set NEXT_PUBLIC_SUPABASE_URL di .env.local', status: 503 }
  }
  if (!serviceKey || serviceKey.startsWith('your-')) {
    return { error: 'Supabase belum dikonfigurasi: set SUPABASE_SERVICE_ROLE_KEY di .env.local', status: 503 }
  }
  try {
    const { createClient } = await import('@supabase/supabase-js')
    return { client: createClient(url as string, serviceKey as string) }
  } catch (err: any) {
    return { error: `Supabase client error: ${err?.message || 'tidak diketahui'}`, status: 503 }
  }
}

/** Compatibility wrapper — balas apa adanya (hanya pakai saat yakin env sudah benar). */
export async function createServiceClient() {
  const result = await tryCreateServiceClient()
  if ('client' in result) return result.client
  throw new Error(result.error)
}

export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* server component */ }
        },
      },
    }
  )
}
