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
    return error.message
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
  return {
    name: data.name?.trim(),
    slug: data.slug?.toLowerCase().trim(),
    domain: data.domain?.toLowerCase().trim() || null,
    logo_url: data.logo_url?.trim() || null,
    currency_id: data.currency_id || null,
    settings: data.settings || {},
    metadata: data.metadata || {},
  }
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100) // Assuming amounts are stored in cents
}

export function formatNumber(num: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat('en-US', options).format(num)
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