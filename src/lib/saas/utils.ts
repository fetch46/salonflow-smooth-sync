
import { supabase } from '@/integrations/supabase/client';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

// Utility function to handle fetch operations with proper error handling
export async function safeFetch<T>(
  fetchFn: () => Promise<{ data: T | null; error: any }>
): Promise<ApiResponse<T>> {
  try {
    const { data, error } = await fetchFn();
    
    if (error) {
      console.warn('Fetch operation failed:', error);
      return { error: error.message || 'Operation failed' };
    }
    
    return { data: data || undefined };
  } catch (networkError) {
    console.warn('Network error during fetch:', networkError);
    return { error: 'Network error occurred' };
  }
}

// Utility to check if we have a valid Supabase connection
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.auth.getSession();
    return !error || error.message === 'Invalid JWT'; // JWT error is expected when not authenticated
  } catch {
    return false;
  }
}

// Retry mechanism for failed requests
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  
  throw lastError!;
}
