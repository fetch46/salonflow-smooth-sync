
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Expose whether Supabase is configured so UI/logic can adapt gracefully
export const SUPABASE_ENABLED = Boolean(supabaseUrl && supabaseAnonKey)

if (!SUPABASE_ENABLED) {
  // Avoid crashing the app on startup if env vars are missing; warn instead
  console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Backend features are disabled until configured in .env.')
}

// Use safe fallbacks to allow the app to mount without immediate network calls
const effectiveUrl = (SUPABASE_ENABLED ? supabaseUrl : 'https://disabled.invalid') as string
const effectiveAnonKey = (SUPABASE_ENABLED ? supabaseAnonKey : 'public-anon-key') as string

export const supabase = createClient<Database>(effectiveUrl, effectiveAnonKey, {
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

// Only test connection in dev and when configured
if (SUPABASE_ENABLED && import.meta.env.DEV) {
  supabase.from('organizations').select('count', { count: 'exact', head: true })
    .then(({ error }) => {
      if (error) {
        console.error('Supabase connection test failed:', error)
      } else {
        console.log('Supabase connection test successful')
      }
    })
    .catch((err) => {
      console.error('Supabase connection error:', err)
    })
}
