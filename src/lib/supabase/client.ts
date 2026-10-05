import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  
  if (!url || url.includes('your-')) {
    // Return a dummy client that doesn't throw if variables are missing
    return {
      from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ then: () => {} }) }) }) }) }),
      channel: () => ({ on: () => ({ subscribe: () => {} }) }),
      removeChannel: () => {},
    } as any
  }
  
  return createBrowserClient(url, anonKey)
}
