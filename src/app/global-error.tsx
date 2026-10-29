'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/report-error'

// Pengganti root layout kalau layout-nya sendiri yang error, jadi styling ditulis inline
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportError('global-error', error, error.digest ? { digest: error.digest } : undefined)
  }, [error])

  return (
    <html lang="id">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#0c0a09', color: '#f5f5f4', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24 }}>
        <title>Terjadi kesalahan</title>
        <p style={{ fontSize: 40, margin: 0 }}>☕💦</p>
        <h2 style={{ margin: 0 }}>Waduh, ada yang error</h2>
        <p style={{ color: '#a8a29e', margin: 0 }}>Masalahnya sudah kami catat. Coba muat ulang ya.</p>
        <button onClick={() => retry()} style={{ background: '#f59e0b', color: '#0c0a09', border: 0, borderRadius: 16, padding: '12px 24px', fontWeight: 600, fontSize: 16 }}>
          Coba lagi
        </button>
      </body>
    </html>
  )
}
