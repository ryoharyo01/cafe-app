'use client'

import { useState, useRef, useEffect } from 'react'
import { useCartStore } from '@/store/cart'
import { Send, Loader2, Coffee } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AIChat({ active = true }: { active?: boolean }) {
  const tableId = useCartStore(s => s.tableId)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Halo! Aku Kopi ☕ Mau rekomendasi menu? Atau lagi cari sesuatu yang spesifik?' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to the latest message, including when the tab becomes visible again (hiding resets scroll)
  useEffect(() => {
    if (active) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, active])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, table_id: tableId }),
      })
      const data = await res.json()
      // Error responses (429 rate limit, 503 not configured) carry `error`, not `reply`
      const content = data.reply || data.error || 'Maaf, aku lagi error nih 😅 Coba lagi ya!'
      setMessages(prev => [...prev, { role: 'assistant', content }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, aku lagi error nih 😅 Coba lagi ya!' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-140px)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center mr-2 shrink-0 mt-1">
                <Coffee className="w-4 h-4 text-stone-950" />
              </div>
            )}
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-amber-500 text-stone-950 rounded-br-md'
                : 'bg-stone-800 text-stone-100 rounded-bl-md'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center mr-2 shrink-0">
              <Coffee className="w-4 h-4 text-stone-950" />
            </div>
            <div className="bg-stone-800 px-4 py-3 rounded-2xl rounded-bl-md">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-16 bg-stone-950 pt-2 pb-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
            enterKeyHint="send"
            placeholder="Tanya Kopi..."
            className="flex-1 bg-stone-800 border border-stone-700 rounded-2xl px-4 py-3 text-stone-100 placeholder:text-stone-500"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center disabled:opacity-50"
          >
            <Send className="w-5 h-5 text-stone-950" />
          </button>
        </div>
      </div>
    </div>
  )
}
