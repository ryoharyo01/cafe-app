'use client'

import { Coffee } from 'lucide-react'
import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      {/* Logo / Branding */}
      <div className="mb-8 flex flex-col items-center gap-4">
        <div className="w-24 h-24 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
          <Coffee className="w-12 h-12 text-amber-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-stone-100">
          Kopi Nusantara
        </h1>
        <p className="text-stone-400 text-sm uppercase tracking-widest">
          Specialty Coffee &amp; Eatery
        </p>
      </div>

      {/* Main Message */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-8 max-w-sm w-full">
        <p className="text-stone-300 text-lg leading-relaxed">
          Scan <span className="text-amber-500 font-semibold">QR code</span> di
          meja untuk mulai pesan
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-stone-500 text-sm">
          <div className="w-8 h-[1px] bg-stone-700" />
          <span>atau</span>
          <div className="w-8 h-[1px] bg-stone-700" />
        </div>
        <Link
          href="/table/demo"
          className="mt-4 inline-block w-full py-3 px-6 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl transition-colors"
        >
          Demo Mode →
        </Link>
      </div>

      <p className="mt-8 text-stone-600 text-xs">
        © 2026 Kopi Nusantara. All rights reserved.
      </p>
    </div>
  )
}
