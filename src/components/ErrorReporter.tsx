'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/report-error'

// Pasang sekali di root layout: tangkap error JS & promise rejection yang tidak di-handle
export default function ErrorReporter() {
  useEffect(() => {
    function onError(e: ErrorEvent) {
      reportError('window.onerror', e.error || e.message, e.filename ? { file: e.filename, line: e.lineno, col: e.colno } : undefined)
    }
    function onRejection(e: PromiseRejectionEvent) {
      reportError('unhandledrejection', e.reason)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
