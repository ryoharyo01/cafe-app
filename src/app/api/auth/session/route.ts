import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

// GET /api/auth/session - Info sesi aktif (nama + role). 401 kalau belum login.
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    user: { id: session.id, name: session.name, role: session.role },
  })
}
