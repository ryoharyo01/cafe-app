'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Login failed')
      } else {
        const data = await res.json()
        const role = data?.user?.role
        if (role === 'dapur') router.push('/kds')
        else if (role === 'kasir') router.push('/pos')
        else router.push('/admin')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-zinc-100 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-zinc-900">Admin POS</h1>
          <p className="text-zinc-500 mt-2">Masukkan PIN kasir untuk masuk</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative">
            {/* text-zinc-900 is required: body text defaults to near-white for the dark theme */}
            <input
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full text-center text-3xl tracking-widest p-4 px-14 bg-white text-zinc-900 caret-zinc-900 placeholder:text-zinc-300 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
              placeholder="••••••"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPin(s => !s)}
              aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-zinc-700"
            >
              {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {error && <div className="text-red-500 text-sm text-center">{error}</div>}
          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full bg-zinc-900 text-white py-4 rounded-xl font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}
