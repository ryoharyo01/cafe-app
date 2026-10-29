export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

// stock -1 = tidak terbatas; is_available=false ditampilkan "Sold Out" di admin
export function isSoldOut(item: { is_available: boolean; stock: number }): boolean {
  return !item.is_available || item.stock === 0
}

// Jumlah maksimal yang bisa dipesan untuk satu menu (server membatasi 99 per baris)
export function maxOrderQty(item: { is_available: boolean; stock: number }): number {
  if (isSoldOut(item)) return 0
  return item.stock === -1 ? 99 : Math.min(item.stock, 99)
}

export function generateOrderId(): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD-${ts}-${rand}`
}

// Modifier yang dipilih lebih dari sekali (mis. Extra Shot 2x) disimpan berulang;
// tampilkan digabung jadi "Extra Shot ×2"
export function formatModifiers(mods: { name: string }[]): string[] {
  const counts = new Map<string, number>()
  for (const m of mods) counts.set(m.name, (counts.get(m.name) ?? 0) + 1)
  return [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name))
}
