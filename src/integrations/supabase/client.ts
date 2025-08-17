
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'
import { withTimeout, withRetry } from '@/lib/saas/utils'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

console.log('Supabase URL:', supabaseUrl)
console.log('Supabase Anon Key exists:', !!supabaseAnonKey)

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-web'
    }
  }
})

// Export a connection test that callers can trigger without blocking init
export async function testSupabaseConnection(label = 'supabase'): Promise<{ ok: boolean; info?: string }> {
  try {
    const run = async () => {
      const { error } = await supabase
        .from('organizations' as any)
        .select('id', { head: true, count: 'estimated' })
        .limit(1)
      if (error) throw error
    }

    await withTimeout(withRetry(run, { retries: 2, initialDelayMs: 200 }), 2500, `${label} connectivity`)
    return { ok: true, info: 'connected' }
  } catch (err: any) {
    console.warn('Non-blocking Supabase connectivity issue:', err?.message || err)
    return { ok: false, info: String(err?.message || err) }
  }
}
