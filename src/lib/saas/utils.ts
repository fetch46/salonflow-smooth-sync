import type { 
  UserRole, 
  Permission, 
  SubscriptionStatus, 
  OrganizationSubscription, 
  FeatureAccess,
  SaasError,
  RolePermissions 
} from './types'
import { 
  ROLE_HIERARCHY, 
  ROLE_PERMISSIONS, 
  SAAS_ERROR_CODES,
  USAGE_WARNING_THRESHOLD,
  USAGE_CRITICAL_THRESHOLD 
} from './constants'

/**
 * Role and Permission Utilities
 */

export function hasMinimumRole(userRole: UserRole | null, minimumRole: UserRole): boolean {
  if (!userRole) return false
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole]
}

export function canPerformAction(
  userRole: UserRole | null, 
  action: string, 
  resource: string,
  conditions?: Record<string, any>
): boolean {
  if (!userRole) return false
  
  const permissions = ROLE_PERMISSIONS[userRole] || []
  
  // Check for wildcard permissions (owner role)
  if (permissions.some(p => p.action === '*' && p.resource === '*')) {
    return true
  }
  
  // Check for resource-specific wildcard
  if (permissions.some(p => p.action === '*' && p.resource === resource)) {
    return true
  }
  
  // Check for exact action and resource match
  const exactMatch = permissions.find(p => 
    p.action === action && p.resource === resource
  )
  
  if (!exactMatch) return false
  
  // Check conditions if they exist
  if (exactMatch.conditions && conditions) {
    return Object.entries(exactMatch.conditions).every(([key, value]) => 
      conditions[key] === value
    )
  }
  
  return true
}

export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

export function isRoleHigherThan(role1: UserRole, role2: UserRole): boolean {
  return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2]
}

// Role/permission overrides support
export function buildEffectivePermissions(
  base: RolePermissions,
  overrides?: Record<string, Permission[]>
): RolePermissions {
  if (!overrides) return base
  const result: RolePermissions = { ...base }
  for (const [roleKey, perms] of Object.entries(overrides)) {
    const r = roleKey as UserRole
    // Replace entire set for role if provided
    result[r] = Array.isArray(perms) ? perms : result[r]
  }
  return result
}

export function canPerformActionWithOverrides(
  userRole: UserRole | null,
  action: string,
  resource: string,
  overrides?: Record<string, Permission[]>,
  conditions?: Record<string, any>
): boolean {
  if (!userRole) return false
  const effective = buildEffectivePermissions(ROLE_PERMISSIONS, overrides)
  const permissions = effective[userRole] || []

  if (permissions.some(p => p.action === '*' && p.resource === '*')) return true
  if (permissions.some(p => p.action === '*' && p.resource === resource)) return true

  const exactMatch = permissions.find(p => p.action === action && p.resource === resource)
  if (!exactMatch) return false

  if (exactMatch.conditions && conditions) {
    return Object.entries(exactMatch.conditions).every(([key, value]) => conditions[key] === value)
  }
  return true
}

/**
 * Subscription and Billing Utilities
 */

export function isSubscriptionActive(status: SubscriptionStatus | null): boolean {
  if (!status) return false
  return ['trial', 'active'].includes(status)
}

export function isSubscriptionTrialing(status: SubscriptionStatus | null): boolean {
  return status === 'trial'
}

export function calculateTrialDaysRemaining(subscription: OrganizationSubscription | null): number | null {
  if (!subscription?.trial_end) return null
  
  const trialEnd = new Date(subscription.trial_end)
  const now = new Date()
  const diffTime = trialEnd.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return Math.max(0, diffDays)
}

export function formatSubscriptionStatus(status: SubscriptionStatus): string {
  const statusMap: Record<SubscriptionStatus, string> = {
    trial: 'Trial',
    active: 'Active',
    past_due: 'Past Due',
    canceled: 'Canceled',
    incomplete: 'Incomplete',
    unpaid: 'Unpaid',
  }
  
  return statusMap[status] || status
}

/**
 * Feature and Usage Utilities
 */

export function calculateFeatureAccess(
  enabled: boolean,
  limit?: number,
  usage?: number
): FeatureAccess {
  const unlimited = !limit
  const remaining = limit && usage !== undefined ? Math.max(0, limit - usage) : undefined
  const canCreate = enabled && (unlimited || (remaining !== undefined && remaining > 0))
  const warningThreshold = limit ? Math.floor(limit * USAGE_WARNING_THRESHOLD) : undefined
  
  return {
    enabled,
    limit,
    usage,
    remaining,
    unlimited,
    canCreate,
    warningThreshold,
    upgradeRequired: !enabled,
  }
}

export function isApproachingUsageLimit(usage: number, limit: number): boolean {
  return usage >= (limit * USAGE_WARNING_THRESHOLD)
}

export function isAtUsageLimit(usage: number, limit: number): boolean {
  return usage >= limit
}

export function getUsagePercentage(usage: number, limit: number): number {
  if (limit === 0) return 0
  return Math.min(100, (usage / limit) * 100)
}

export function shouldShowUsageWarning(usage: number, limit: number): boolean {
  const percentage = getUsagePercentage(usage, limit)
  return percentage >= (USAGE_WARNING_THRESHOLD * 100)
}

/**
 * String and Slug Utilities
 */

export function createSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50)
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

/**
 * Date and Time Utilities
 */

export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const targetDate = new Date(date)
  const diffTime = targetDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1) return `In ${diffDays} days`
  if (diffDays < -1) return `${Math.abs(diffDays)} days ago`
  
  return targetDate.toLocaleDateString()
}

export function isDateInFuture(date: string | Date): boolean {
  return new Date(date) > new Date()
}

export function isDateInPast(date: string | Date): boolean {
  return new Date(date) < new Date()
}

/**
 * Error Handling Utilities
 */

export function createSaasError(
  code: keyof typeof SAAS_ERROR_CODES,
  message: string,
  details?: any
): SaasError {
  return {
    code: SAAS_ERROR_CODES[code],
    message,
    details,
  }
}

export function isSaasError(error: any): error is SaasError {
  return error && typeof error === 'object' && 'code' in error && 'message' in error
}

export function getErrorMessage(error: unknown): string {
  if (isSaasError(error)) {
    const detailsMessage = typeof (error as any).details?.message === 'string' ? (error as any).details.message : undefined
    return detailsMessage ? `${error.message}: ${detailsMessage}` : error.message
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  if (typeof error === 'string') {
    return error
  }
  
  return 'An unexpected error occurred'
}

/**
 * Validation Utilities
 */

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validateOrganizationName(name: string): { valid: boolean; message?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, message: 'Organization name is required' }
  }
  
  if (name.length < 2) {
    return { valid: false, message: 'Organization name must be at least 2 characters' }
  }
  
  if (name.length > 100) {
    return { valid: false, message: 'Organization name must be less than 100 characters' }
  }
  
  return { valid: true }
}

export function validateSlug(slug: string): { valid: boolean; message?: string } {
  if (!slug || slug.trim().length === 0) {
    return { valid: false, message: 'Slug is required' }
  }
  
  const slugRegex = /^[a-z0-9-]+$/
  if (!slugRegex.test(slug)) {
    return { valid: false, message: 'Slug can only contain lowercase letters, numbers, and hyphens' }
  }
  
  if (slug.length < 2) {
    return { valid: false, message: 'Slug must be at least 2 characters' }
  }
  
  if (slug.length > 50) {
    return { valid: false, message: 'Slug must be less than 50 characters' }
  }
  
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { valid: false, message: 'Slug cannot start or end with a hyphen' }
  }
  
  return { valid: true }
}

/**
 * Data Transformation Utilities
 */

export function sanitizeOrganizationData(data: any) {
  const updates: any = {}

  if ('name' in data) {
    updates.name = typeof data.name === 'string' ? data.name.trim() : data.name
  }

  if ('slug' in data) {
    updates.slug = typeof data.slug === 'string' ? data.slug.toLowerCase().trim() : data.slug
  }

  if ('domain' in data) {
    const domainVal = data.domain
    updates.domain = domainVal === null
      ? null
      : (typeof domainVal === 'string' ? domainVal.toLowerCase().trim() : domainVal)
  }

  if ('logo_url' in data) {
    const logoVal = data.logo_url
    updates.logo_url = logoVal === null
      ? null
      : (typeof logoVal === 'string' ? logoVal.trim() : logoVal)
  }

  if ('currency_id' in data) {
    // Allow explicit null to clear the association
    updates.currency_id = data.currency_id ?? null
  }

  if ('settings' in data) {
    // If settings provided, use it as-is (caller should merge with existing if needed)
    // Default to {} only if explicitly passed as undefined/null-like
    updates.settings = data.settings ?? {}
  }

  if ('metadata' in data) {
    updates.metadata = data.metadata ?? {}
  }

  return updates
}

export function formatCurrency(amount: number, currency: string = 'USD', locale?: string): string {
  const resolvedLocale = locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US')
  return new Intl.NumberFormat(resolvedLocale, {
    style: 'currency',
    currency,
  }).format(amount / 100) // Assuming amounts are stored in cents
}

export function formatNumber(num: number, options?: Intl.NumberFormatOptions, locale?: string): string {
  const resolvedLocale = locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US')
  return new Intl.NumberFormat(resolvedLocale, options).format(num)
}

/**
 * Cache Utilities
 */

export function createCacheKey(...parts: (string | number)[]): string {
  return parts.join(':')
}

export function isExpired(timestamp: number, ttlMs: number): boolean {
  return Date.now() - timestamp > ttlMs
}

/**
 * Feature Flag Utilities
 */

export function checkFeatureFlag(features: Record<string, any>, flagName: string): boolean {
  return Boolean(features[flagName])
}

export function getFeatureValue<T>(
  features: Record<string, any>, 
  flagName: string, 
  defaultValue: T
): T {
  return features[flagName] !== undefined ? features[flagName] : defaultValue
}

/**
 * Array and Object Utilities
 */

export function groupBy<T, K extends keyof any>(
  array: T[],
  key: (item: T) => K
): Record<K, T[]> {
  return array.reduce((groups, item) => {
    const group = key(item)
    groups[group] = groups[group] || []
    groups[group].push(item)
    return groups
  }, {} as Record<K, T[]>)
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

export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj }
  keys.forEach(key => delete result[key])
  return result
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key]
    }
  })
  return result
}

/**
 * Network and Resilience Utilities
 */

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  const timeout = new Promise<T>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id)
      reject(new Error(`${label} timed out after ${ms}ms`))
    }, ms)
  })
  return Promise.race([promise, timeout]) as Promise<T>
}

export function isNetworkError(error: unknown): boolean {
  if (typeof window !== 'undefined' && !navigator.onLine) return true
  const message = typeof error === 'string' ? error : (error as any)?.message
  if (typeof message === 'string') {
    return /network\s?error|failed\s?to\s?fetch|load\s?failed|ERR_NETWORK/i.test(message)
  }
  return false
}

export interface RetryOptions {
  retries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  factor?: number
  shouldRetry?: (error: unknown, attempt: number) => boolean
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    retries = 3,
    initialDelayMs = 200,
    maxDelayMs = 2000,
    factor = 2,
    shouldRetry = (err) => isNetworkError(err),
  } = options

  let attempt = 0
  let delayMs = initialDelayMs

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn()
    } catch (error) {
      attempt += 1
      if (attempt > retries || !shouldRetry(error, attempt)) {
        throw error
      }
      await delay(delayMs)
      delayMs = Math.min(maxDelayMs, delayMs * factor)
    }
  }
}

export async function safeFetch<T = unknown>(input: RequestInfo | URL, init?: RequestInit, fallback?: T): Promise<T> {
  try {
    const res = await fetch(input, init)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    // @ts-expect-error generic parse
    return await res.json()
  } catch (error) {
    if (fallback !== undefined) return fallback
    throw error
  }
}

// Supabase error helpers
export function isMissingRelationError(error: any): boolean {
  const code = error?.code
  const msg = (error?.message || error?.details || '').toString()
  // Postgres undefined table 42P01, undefined column 42703. PostgREST not found PGRST116
  return code === '42P01' || code === '42703' || code === 'PGRST116' || /does not exist|not found/i.test(msg)
}

export function isAuthError(error: any): boolean {
  const code = error?.code
  return code === 'PGRST301' || code === '401' || /jwt|auth/i.test(String(error?.message || ''))
}

export async function safeSupabaseCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (_err) {
    return fallback
  }
}