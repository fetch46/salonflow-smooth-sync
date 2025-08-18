
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
