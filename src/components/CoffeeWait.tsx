'use client'

// Animated coffee-cup waiting indicator for customer-facing screens (QR table
// loading + order status). Pure SVG + CSS keyframes from globals.css.

export type CoffeeStage = 'loading' | 'pending' | 'paid' | 'preparing' | 'ready' | 'served'

const COPY: Record<CoffeeStage, { title: string; subtitle?: string; color: string }> = {
  loading: { title: 'Menyiapkan meja kamu...', subtitle: 'Sebentar, menu lagi dimuat', color: 'text-amber-400' },
  pending: { title: 'Menunggu pembayaran...', subtitle: 'Selesaikan pembayaran QRIS kamu', color: 'text-stone-300' },
  paid: { title: 'Pesanan diterima', subtitle: 'Menunggu barista mulai nyiapin...', color: 'text-amber-400' },
  preparing: { title: 'Barista lagi nyiapin pesanan kamu... ☕', subtitle: 'Tunggu sebentar ya', color: 'text-blue-400' },
  ready: { title: 'Pesanan siap diantar! 🎉', color: 'text-green-400' },
  served: { title: 'Pesanan sudah diantar. Selamat menikmati! 😊', color: 'text-emerald-400' },
}

// How far the liquid is pushed down (px in the 120x120 viewBox); 50 = empty, 8 = full
const STATIC_LEVEL: Partial<Record<CoffeeStage, number>> = {
  pending: 50,
  paid: 40,
  ready: 8,
  served: 8,
}

const CUP_INTERIOR = 'M30 50 L90 50 L84 95 Q83 100 78 100 L42 100 Q37 100 36 95 Z'

export function CoffeeCup({ stage, className = 'w-32 h-32' }: { stage: CoffeeStage; className?: string }) {
  const steam = stage !== 'pending' && stage !== 'served'
  const strongSteam = stage === 'ready'
  const level = STATIC_LEVEL[stage]
  const liquidClass =
    stage === 'loading' ? 'coffee-fill-loop' : stage === 'preparing' ? 'coffee-fill-brew' : ''
  const cupClass =
    stage === 'pending' ? 'coffee-wobble' : stage === 'ready' ? 'coffee-pop' : ''

  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={COPY[stage].title}>
      <defs>
        <clipPath id="coffee-cup-clip">
          <path d={CUP_INTERIOR} />
        </clipPath>
      </defs>

      {/* Steam */}
      {steam && (
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className={`text-stone-400 ${strongSteam ? 'coffee-steam-strong' : ''}`}
        >
          <path className="coffee-steam" d="M46 44 q-6 -7 0 -14 q6 -7 0 -14" />
          <path className="coffee-steam coffee-delay-1" d="M60 44 q-6 -7 0 -14 q6 -7 0 -14" />
          <path className="coffee-steam coffee-delay-2" d="M74 44 q-6 -7 0 -14 q6 -7 0 -14" />
        </g>
      )}

      {/* Pour stream while brewing */}
      {stage === 'preparing' && (
        <rect x="57.5" y="0" width="5" height="62" rx="2.5" fill="#92400e" className="coffee-pour" />
      )}

      <g className={cupClass}>
        {/* Saucer */}
        <ellipse cx="60" cy="104" rx="42" ry="5" fill="#292524" />
        {/* Handle */}
        <path d="M88 60 q17 0 15 14 q-2 12 -18 12" fill="none" stroke="#e7e5e4" strokeWidth="6" />
        {/* Cup body */}
        <path d={CUP_INTERIOR} fill="#1c1917" />
        {/* Liquid */}
        <g clipPath="url(#coffee-cup-clip)">
          <g
            className={liquidClass}
            style={level != null ? { transform: `translateY(${level}px)` } : undefined}
          >
            <rect x="25" y="50" width="70" height="55" fill="#78350f" />
            <rect x="25" y="50" width="70" height="4" fill="#d97706" opacity="0.7" />
          </g>
        </g>
        {/* Cup outline on top so the liquid edge stays clean */}
        <path d={CUP_INTERIOR} fill="none" stroke="#e7e5e4" strokeWidth="4" strokeLinejoin="round" />
      </g>

      {/* Sparkles when ready */}
      {stage === 'ready' && (
        <g fill="#fbbf24">
          <path className="coffee-sparkle" d="M18 40 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" />
          <path className="coffee-sparkle coffee-delay-1" d="M102 30 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 Z" />
          <path className="coffee-sparkle coffee-delay-2" d="M98 92 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 Z" />
        </g>
      )}
    </svg>
  )
}

export default function CoffeeWait({ stage, compact = false }: { stage: CoffeeStage; compact?: boolean }) {
  const copy = COPY[stage]
  const busy = stage !== 'ready' && stage !== 'served'

  return (
    <div key={stage} className="flex flex-col items-center text-center animate-slide-in" role="status" aria-live="polite">
      <CoffeeCup stage={stage} className={compact ? 'w-24 h-24' : 'w-32 h-32'} />
      <p className={`mt-3 font-semibold ${copy.color} ${stage === 'ready' ? 'text-lg' : ''}`}>{copy.title}</p>
      {copy.subtitle && <p className="text-stone-500 text-sm mt-1">{copy.subtitle}</p>}
      {busy && (
        <div className="mt-4 w-40 h-1.5 rounded-full bg-stone-800 overflow-hidden">
          <div className="h-full w-2/5 rounded-full bg-amber-500 coffee-indeterminate" />
        </div>
      )}
    </div>
  )
}
