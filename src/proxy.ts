import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

export async function proxy(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value

  // Web pages without a session go straight to /login (no secret needed)
  const isUi = request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname.startsWith('/kds')
  const isApi = request.nextUrl.pathname.startsWith('/api/admin') || (request.method === 'PATCH' && !!request.nextUrl.pathname.match(/^\/api\/orders\/.*\/status$/))

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

  if (isUi) {
    try {
      const decoded = await jwtVerify(token, secret)
      const role = decoded.payload.role as string
      
      if (request.nextUrl.pathname.startsWith('/admin') && role !== 'admin') {
        return NextResponse.redirect(new URL('/login', request.url))
      }
      
      if (request.nextUrl.pathname.startsWith('/kds') && !['admin', 'dapur'].includes(role)) {
        return NextResponse.redirect(new URL('/login', request.url))
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
  matcher: ['/admin/:path*', '/kds/:path*', '/api/admin/:path*', '/api/orders/:id/status'],
}
