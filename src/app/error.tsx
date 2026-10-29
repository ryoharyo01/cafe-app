'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/report-error'

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportError('error-boundary', error, error.digest ? { digest: error.digest } : undefined)
  }, [error])

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-4xl">☕💦</p>
      <h2 className="text-xl font-bold">Waduh, ada yang error</h2>
      <p className="text-stone-400 text-sm max-w-sm">Masalahnya sudah kami catat. Coba muat ulang ya.</p>
      <button onClick={() => retry()} className="bg-amber-500 text-stone-950 font-semibold px-6 py-3 rounded-2xl">
        Coba lagi
      </button>
    </div>
  )
}
