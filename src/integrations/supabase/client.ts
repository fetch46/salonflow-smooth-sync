
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

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

// Test connection with a simple query that should always work, with better error handling
const testConnection = async () => {
  try {
    // Try a simple auth check first
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError && authError.message !== 'Invalid JWT') {
      console.warn('Supabase auth test warning:', authError.message);
    } else {
      console.log('Supabase auth connection successful');
    }

    // Try to access a table that should exist
    const { error: tableError } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });
    
    if (tableError) {
      console.warn('Supabase table access test failed:', tableError.message);
    } else {
      console.log('Supabase database connection test successful');
    }
  } catch (err) {
    console.warn('Supabase connection test failed with network error, but client is configured:', err);
  }
};

// Run connection test with a delay to avoid blocking app initialization
setTimeout(testConnection, 1000);
