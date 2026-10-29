'use client'

// Riwayat pesanan pelanggan di satu meja, disimpan di sessionStorage per token meja.
// Scan ulang QR = sesi baru: riwayat lama dihapus. Refresh, tombol back, atau
// balik dari halaman status/pembayaran tetap mempertahankan riwayat.

const key = (token: string) => `cafe-history-${token}`

// Satu dokumen hanya dicek sekali, supaya navigasi client (status -> menu) tidak ikut menghapus
let checkedThisDocument = false

// Dipanggil saat halaman meja dibuka
export function startHistorySession(token: string) {
  if (checkedThisDocument) return
  checkedThisDocument = true
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    // 'navigate' langsung ke URL meja = hasil scan QR (refresh = 'reload', back = 'back_forward')
    const scanned = nav?.type === 'navigate' && new URL(nav.name).pathname === `/table/${token}`
    if (scanned) sessionStorage.removeItem(key(token))
  } catch {
    // sessionStorage bisa diblokir (private mode); riwayat cukup tidak tersimpan
  }
}

export function getHistory(token: string): string[] {
  try {
    const ids = JSON.parse(sessionStorage.getItem(key(token)) || '[]')
    return Array.isArray(ids) ? ids : []
  } catch {
    return []
  }
}

export function addToHistory(token: string, orderId: string) {
  try {
    const ids = getHistory(token).filter(id => id !== orderId)
    sessionStorage.setItem(key(token), JSON.stringify([orderId, ...ids]))
  } catch {
    // abaikan
  }
}
