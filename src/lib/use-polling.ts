'use client'

import { useEffect, useRef } from 'react'

// Calls fn every `ms` while the tab is visible, and right away when the tab
// comes back into view. Supabase realtime can't deliver order changes to the
// browser (RLS blocks anon reads on orders), so pages rely on this instead.
export function usePolling(fn: () => unknown, ms: number, enabled = true) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (timer) return
      timer = setInterval(() => fnRef.current(), ms)
    }
    const stop = () => {
      if (timer) clearInterval(timer)
      timer = null
    }
    const onVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        fnRef.current()
        start()
      }
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
    }
  }, [ms, enabled])
}
