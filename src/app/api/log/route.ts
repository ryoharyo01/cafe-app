import { NextRequest, NextResponse } from 'next/server'
import { writeLog } from '@/lib/logger'
import { clientIp } from '@/lib/rate-limit'

const MAX_BODY = 16 * 1024

// POST /api/log - laporan error dari browser (publik, tanpa login; rate limit di proxy.ts)
export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers)

  const raw = await request.text().catch(() => '')
  if (!raw || raw.length > MAX_BODY) return new NextResponse(null, { status: 400 })

  let body: any
  try {
    body = JSON.parse(raw)
  } catch {
    return new NextResponse(null, { status: 400 })
  }
  if (!body || typeof body.message !== 'string' || !body.message.trim()) {
    return new NextResponse(null, { status: 400 })
  }

  await writeLog({
    level: body.level === 'warn' ? 'warn' : 'error',
    source: 'client',
    context: typeof body.context === 'string' ? body.context : 'client',
    message: body.message,
    stack: typeof body.stack === 'string' ? body.stack : null,
    meta: body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta) ? body.meta : null,
    url: typeof body.url === 'string' ? body.url : null,
    user_agent: request.headers.get('user-agent'),
    ip,
  })

  return new NextResponse(null, { status: 204 })
}
