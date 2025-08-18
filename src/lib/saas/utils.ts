import { toast } from 'sonner'

// Retry wrapper for database operations
export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: { retries: number; initialDelayMs: number } = { retries: 3, initialDelayMs: 500 }
): Promise<T> => {
  let lastError: any
  let delay = options.initialDelayMs

  for (let i = 0; i <= options.retries; i++) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error
      if (i === options.retries) {
        console.error('Operation failed after multiple retries:', error)
        throw lastError
      }
      console.log(`Attempt ${i + 1} failed. Retrying in ${delay}ms...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      delay *= 2 // Exponential backoff
    }
  }
  throw lastError
}

// Timeout utility
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  operationName: string = 'Operation'
): Promise<T> {
  const timeout = new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${ms}ms`))
    }, ms)
  })
  return Promise.race([promise, timeout])
}

export function isMissingRelationError(error: any): boolean {
  if (!error) return false
  
  // Check for common missing relation error patterns
  const errorMessage = error.message || error.toString() || ''
  
  return (
    errorMessage.includes('relation') && errorMessage.includes('does not exist') ||
    errorMessage.includes('table') && errorMessage.includes('does not exist') ||
    errorMessage.includes('undefined table') ||
    error.code === '42P01' // PostgreSQL "relation does not exist" error code
  )
}
