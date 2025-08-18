

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

// Subscription status utilities
export function isSubscriptionActive(status: string | null | undefined): boolean {
  return status === 'active'
}

export function isSubscriptionTrialing(status: string | null | undefined): boolean {
  return status === 'trialing'
}

// Feature access calculation
export interface FeatureAccess {
  enabled: boolean
  limit?: number
  usage?: number
  remaining?: number
  unlimited: boolean
  canCreate: boolean
  warningThreshold?: number
  upgradeRequired: boolean
}

export function calculateFeatureAccess(
  enabled: boolean, 
  limit?: number, 
  usage?: number
): FeatureAccess {
  const unlimited = !limit
  const currentUsage = usage || 0
  const remaining = limit ? Math.max(0, limit - currentUsage) : undefined
  const canCreate = enabled && (unlimited || (remaining !== undefined && remaining > 0))
  const warningThreshold = limit ? Math.floor(limit * 0.8) : undefined

  return {
    enabled,
    limit,
    usage: currentUsage,
    remaining,
    unlimited,
    canCreate,
    warningThreshold,
    upgradeRequired: !enabled,
  }
}

// Role hierarchy definitions
export type UserRole = 'owner' | 'admin' | 'manager' | 'staff' | 'viewer'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  staff: 2,
  viewer: 1,
}

// Role-based permissions
const ROLE_PERMISSIONS: Record<UserRole, Record<string, string[]>> = {
  owner: {
    users: ['create', 'read', 'update', 'delete', 'invite'],
    organization: ['create', 'read', 'update', 'delete'],
    billing: ['create', 'read', 'update', 'delete'],
    settings: ['create', 'read', 'update', 'delete'],
    appointments: ['create', 'read', 'update', 'delete'],
    clients: ['create', 'read', 'update', 'delete'],
    services: ['create', 'read', 'update', 'delete'],
    staff: ['create', 'read', 'update', 'delete'],
    reports: ['read'],
    inventory: ['create', 'read', 'update', 'delete'],
  },
  admin: {
    users: ['create', 'read', 'update', 'delete', 'invite'],
    organization: ['read', 'update'],
    billing: ['read'],
    settings: ['read', 'update'],
    appointments: ['create', 'read', 'update', 'delete'],
    clients: ['create', 'read', 'update', 'delete'],
    services: ['create', 'read', 'update', 'delete'],
    staff: ['create', 'read', 'update', 'delete'],
    reports: ['read'],
    inventory: ['create', 'read', 'update', 'delete'],
  },
  manager: {
    users: ['read', 'invite'],
    organization: ['read'],
    billing: [],
    settings: ['read'],
    appointments: ['create', 'read', 'update', 'delete'],
    clients: ['create', 'read', 'update', 'delete'],
    services: ['create', 'read', 'update'],
    staff: ['read', 'update'],
    reports: ['read'],
    inventory: ['create', 'read', 'update'],
  },
  staff: {
    users: [],
    organization: ['read'],
    billing: [],
    settings: ['read'],
    appointments: ['create', 'read', 'update'],
    clients: ['create', 'read', 'update'],
    services: ['read'],
    staff: ['read'],
    reports: [],
    inventory: ['read', 'update'],
  },
  viewer: {
    users: [],
    organization: ['read'],
    billing: [],
    settings: ['read'],
    appointments: ['read'],
    clients: ['read'],
    services: ['read'],
    staff: ['read'],
    reports: [],
    inventory: ['read'],
  },
}

// Permission checking utilities
export function hasMinimumRole(userRole: UserRole | null | undefined, minRole: UserRole): boolean {
  if (!userRole) return false
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole]
}

export function canPerformAction(
  userRole: UserRole | null | undefined, 
  action: string, 
  resource: string
): boolean {
  if (!userRole) return false
  
  const permissions = ROLE_PERMISSIONS[userRole]
  if (!permissions) return false
  
  const resourcePermissions = permissions[resource]
  if (!resourcePermissions) return false
  
  return resourcePermissions.includes(action)
}

export function canPerformActionWithOverrides(
  userRole: UserRole | null | undefined,
  action: string,
  resource: string,
  overrides: Record<string, Record<string, string[]>>
): boolean {
  if (!userRole) return false
  
  // Check overrides first
  if (overrides && overrides[userRole] && overrides[userRole][resource]) {
    const overridePermissions = overrides[userRole][resource]
    if (overridePermissions.includes(action)) return true
  }
  
  // Fall back to default permissions
  return canPerformAction(userRole, action, resource)
}

// Additional utility functions that are exported in the index
export function getRolePermissions(role: UserRole): Record<string, string[]> {
  return ROLE_PERMISSIONS[role] || {}
}

export function isRoleHigherThan(userRole: UserRole, compareRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] > ROLE_HIERARCHY[compareRole]
}

export function calculateTrialDaysRemaining(trialEndDate: string | Date): number {
  const endDate = new Date(trialEndDate)
  const now = new Date()
  const diffTime = endDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

export function formatSubscriptionStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function isApproachingUsageLimit(usage: number, limit: number, threshold: number = 0.8): boolean {
  return usage >= limit * threshold
}

export function isAtUsageLimit(usage: number, limit: number): boolean {
  return usage >= limit
}

export function getUsagePercentage(usage: number, limit: number): number {
  return limit > 0 ? Math.min(100, (usage / limit) * 100) : 0
}

export function shouldShowUsageWarning(usage: number, limit: number): boolean {
  return isApproachingUsageLimit(usage, limit, 0.8)
}

export function createSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function generateUniqueSlug(baseName: string, existingSlugs: string[]): string {
  let slug = createSlugFromName(baseName)
  let counter = 1
  
  while (existingSlugs.includes(slug)) {
    slug = `${createSlugFromName(baseName)}-${counter}`
    counter++
  }
  
  return slug
}

export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}

export function isDateInFuture(date: Date): boolean {
  return date.getTime() > new Date().getTime()
}

export function isDateInPast(date: Date): boolean {
  return date.getTime() < new Date().getTime()
}

export function createSaasError(code: string, message: string, details?: any): Error {
  const error = new Error(message)
  ;(error as any).code = code
  ;(error as any).details = details
  return error
}

export function isSaasError(error: any): boolean {
  return error && typeof error.code === 'string'
}

export function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error
  if (error?.message) return error.message
  return 'An unknown error occurred'
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validateOrganizationName(name: string): boolean {
  return name.length >= 2 && name.length <= 100
}

export function validateSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9-]+$/
  return slugRegex.test(slug) && slug.length >= 2 && slug.length <= 50
}

export function sanitizeOrganizationData(data: any): any {
  const { password, ...sanitized } = data
  return sanitized
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num)
}

export function createCacheKey(...parts: string[]): string {
  return parts.join(':')
}

export function isExpired(timestamp: number, ttlMs: number): boolean {
  return Date.now() - timestamp > ttlMs
}

export function checkFeatureFlag(flags: Record<string, boolean>, flag: string): boolean {
  return flags[flag] === true
}

export function getFeatureValue(features: Record<string, any>, feature: string, defaultValue: any = null): any {
  return features[feature] !== undefined ? features[feature] : defaultValue
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const group = String(item[key])
    groups[group] = groups[group] || []
    groups[group].push(item)
    return groups
  }, {} as Record<string, T[]>)
}

export function sortBy<T>(array: T[], key: keyof T): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key]
    const bVal = b[key]
    if (aVal < bVal) return -1
    if (aVal > bVal) return 1
    return 0
  })
}

export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj }
  keys.forEach(key => delete result[key])
  return result
}

export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key]
    }
  })
  return result
}

// Safe helpers
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function isNetworkError(error: any): boolean {
  return error?.code === 'NETWORK_ERROR' || 
         error?.message?.includes('network') ||
         error?.message?.includes('fetch')
}

export async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(url, options)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return response
  } catch (error) {
    console.error('Fetch error:', error)
    throw error
  }
}

export function isAuthError(error: any): boolean {
  return error?.status === 401 || 
         error?.message?.includes('unauthorized') ||
         error?.message?.includes('authentication')
}

export async function safeSupabaseCall<T>(
  operation: () => Promise<{ data: T; error: any }>
): Promise<T> {
  try {
    const { data, error } = await operation()
    if (error) throw error
    return data
  } catch (error) {
    console.error('Supabase operation failed:', error)
    throw error
  }
}
