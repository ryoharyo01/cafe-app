'use client'

import { useRouter } from 'next/navigation'
import POS from '@/components/POS'
import { Banknote, LogOut, ChefHat } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'

export default function PosPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    // Nama & peran kasir diambil dari cookie sesi lewat endpoint ringan.
    fetch('/api/auth/session')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.name) setName(d.user.name)
        if (d?.user?.role) setRole(d.user.role)
      })
      .catch(() => {})
  }, [])

  // Tombol Dapur cuma untuk peran yang memang boleh masuk /kds.
  // Kasir tidak boleh — proxy akan mengalihkannya, jadi tombolnya jangan
  // ditampilkan sebagai jalan buntu.
  const canOpenKitchen = ['admin', 'dapur'].includes(role)

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch {
      toast.error('Gagal keluar')
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="border-b border-stone-800 bg-stone-900 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-amber-500 font-bold text-lg flex items-center gap-2">
            <Banknote className="w-5 h-5" /> Kasir
          </span>
          {name && <span className="text-stone-400 text-sm">· {name}</span>}
          <div className="ml-auto flex items-center gap-2">
            {canOpenKitchen && (
              <button
                onClick={() => router.push('/kds')}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-stone-800 hover:bg-stone-700 text-stone-300"
              >
                <ChefHat className="w-4 h-4" /> Dapur
              </button>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-stone-800 hover:bg-stone-700 text-stone-300"
            >
              <LogOut className="w-4 h-4" /> Keluar
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        <POS />
      </div>
    </div>
  )
}
