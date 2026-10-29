import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { clientIp, hit, ruleFor } from '@/lib/rate-limit'

export async function proxy(request: NextRequest) {
  // Rate limit API publik sebelum cek auth
  const rule = ruleFor(request.method, request.nextUrl.pathname)
  if (rule) {
    const ip = clientIp(request.headers)
    const rl = hit(rule, ip)
    if (!rl.ok) {
      if (rl.firstBlocked) {
        const { logWarn } = await import('@/lib/logger')
        await logWarn('rate-limit', `${rule.name}: ${ip} melewati ${rule.limit} request/${rule.windowMs / 1000}s`, {
          method: request.method,
          path: request.nextUrl.pathname,
        })
      }
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Terlalu banyak request. Coba lagi sebentar ya.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(rl.limit),
            'X-RateLimit-Remaining': '0',
          },
        },
      )
    }
  }

  const token = request.cookies.get('admin_session')?.value

  // Web pages without a session go straight to /login (no secret needed)
  const isUi =
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/kds') ||
    request.nextUrl.pathname.startsWith('/pos')
  const isApi =
    request.nextUrl.pathname.startsWith('/api/admin') ||
    request.nextUrl.pathname.startsWith('/api/pos') ||
    (request.method === 'PATCH' && !!request.nextUrl.pathname.match(/^\/api\/orders\/.*\/status$/))

  if (!token) {
    if (isUi) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // Token present: verifying it requires JWT_SECRET, otherwise fail with 500
  if (!process.env.JWT_SECRET) {
    return NextResponse.json({ error: 'Internal Server Error: JWT_SECRET missing' }, { status: 500 })
  }
  const secret = new TextEncoder().encode(process.env.JWT_SECRET)

  // Halaman utama tiap peran. Dipakai kalau user yang SUDAH login membuka
  // halaman milik peran lain: antar ke rumahnya sendiri, jangan buang
  // sesinya dengan melempar ke /login.
  const homeFor = (role: string) =>
    role === 'kasir' ? '/pos' : role === 'dapur' ? '/kds' : '/admin'

  if (isUi) {
    try {
      const decoded = await jwtVerify(token, secret)
      const role = decoded.payload.role as string
      
      if (request.nextUrl.pathname.startsWith('/admin') && role !== 'admin') {
        return NextResponse.redirect(new URL(homeFor(role), request.url))
      }
      
      if (request.nextUrl.pathname.startsWith('/kds') && !['admin', 'dapur'].includes(role)) {
        return NextResponse.redirect(new URL(homeFor(role), request.url))
      }

      if (request.nextUrl.pathname.startsWith('/pos') && !['admin', 'kasir'].includes(role)) {
        return NextResponse.redirect(new URL(homeFor(role), request.url))
      }
      
      return NextResponse.next()
    } catch (e) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  if (isApi) {
    try {
      const decoded = await jwtVerify(token, secret)
      const role = decoded.payload.role as string

      if (request.nextUrl.pathname.startsWith('/api/admin') && role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 })
      }

      // POS kasir: admin & kasir boleh jualan; dapur tidak.
      if (request.nextUrl.pathname.startsWith('/api/pos') && !['admin', 'kasir'].includes(role)) {
        return NextResponse.json({ error: 'Forbidden: Admin atau Kasir only' }, { status: 403 })
      }
      
      if (request.method === 'PATCH' && !!request.nextUrl.pathname.match(/^\/api\/orders\/.*\/status$/) && !['admin', 'dapur'].includes(role)) {
        return NextResponse.json({ error: 'Forbidden: Admin or Dapur only' }, { status: 403 })
      }

      return NextResponse.next()
    } catch (e) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/kds/:path*',
    '/pos/:path*',
    '/api/:path*',
  ],
}
