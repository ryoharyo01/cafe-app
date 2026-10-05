import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kopi Nusantara — Pesan dari Meja',
  description: 'Pesan makanan dan minuman langsung dari meja kamu',
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-stone-950 text-stone-100">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1c1917',
              color: '#f5f5f4',
              border: '1px solid #44403c',
              borderRadius: '1rem',
            },
            success: {
              iconTheme: { primary: '#f59e0b', secondary: '#1c1917' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#1c1917' },
            },
          }}
        />
      </body>
    </html>
  )
}
